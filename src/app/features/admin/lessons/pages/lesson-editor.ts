import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, startWith, Subject, switchMap } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { AuthSession } from '../../../../core/auth/auth-session.service';
import {
  LessonFieldErrors,
  LessonDraft,
  LessonLevel,
  LessonMetadata,
  LessonWriteRequest,
  positiveInteger,
  validateLesson,
} from '../models/lesson.model';
import { lessonError } from '../models/lesson-error';
import { AdminLessonService } from '../services/admin-lesson.service';

@Component({
  selector: 'app-admin-lesson-editor',
  imports: [FormsModule, RouterLink],
  templateUrl: './lesson-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonEditor {
  private readonly service = inject(AdminLessonService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  private baseline = '';
  private id: number | null = null;
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly levels = signal<readonly LessonLevel[]>([]);
  readonly saving = signal(false);
  readonly message = signal('');
  readonly fields = signal<LessonFieldErrors>({});
  readonly editing = signal(false);
  readonly lessonId = signal<number | null>(null);
  draft: LessonDraft = this.empty();

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) =>
          this.reload.pipe(
            startWith(undefined),
            switchMap(() => {
              this.state.set('loading');
              this.message.set('');
              this.fields.set({});
              const raw = params.get('lessonId');
              this.editing.set(raw !== null);
              this.id =
                raw !== null && /^\d+$/.test(raw) && positiveInteger(Number(raw))
                  ? Number(raw)
                  : null;
              this.lessonId.set(this.id);
              if (raw !== null && this.id === null)
                return of({ error: 'Invalid lesson ID. Return to the lesson list.' });
              return forkJoin({
                levels: this.service.getLevels(),
                lesson: this.id === null ? of(null) : this.service.getLesson(this.id),
              }).pipe(
                map(({ levels, lesson }) => ({
                  levels: levels.data,
                  lesson: lesson?.data ?? null,
                })),
                catchError((error: unknown) => of({ error: lessonError(error) })),
              );
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if ('error' in result) {
          this.state.set('error');
          this.message.set(result.error);
          return;
        }
        this.levels.set(result.levels);
        const lesson = result.lesson;
        if (lesson && !result.levels.some((level) => level.id === lesson.levelId)) {
          this.state.set('error');
          this.message.set('This lesson references an unavailable JLPT level.');
          return;
        }
        this.draft = lesson
          ? this.request(lesson)
          : {
              ...this.empty(),
              levelId:
                result.levels.find(
                  (level) => level.code === this.route.snapshot.queryParamMap.get('level'),
                )?.id ??
                result.levels.find((level) => level.code === 'N5')?.id ??
                null,
            };
        this.baseline = JSON.stringify(this.draft);
        this.state.set('ready');
      });
  }
  private empty(): LessonDraft {
    return { levelId: null, lessonNumber: null, title: '', description: '', displayOrder: null };
  }
  private request(lesson: LessonMetadata): LessonWriteRequest {
    return {
      levelId: lesson.levelId,
      lessonNumber: lesson.lessonNumber,
      title: lesson.title,
      description: lesson.description,
      displayOrder: lesson.displayOrder,
    };
  }
  dirty(): boolean {
    return this.state() === 'ready' && JSON.stringify(this.draft) !== this.baseline;
  }
  canLeave(): boolean {
    return !this.saving() && (!this.dirty() || window.confirm('Discard unsaved lesson changes?'));
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty() || this.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  retry(): void {
    if (!this.saving()) this.reload.next();
  }
  cancel(): void {
    if (this.canLeave()) {
      this.baseline = JSON.stringify(this.draft);
      void this.router.navigate(['/admin/lessons']);
    }
  }
  save(): void {
    if (this.state() !== 'ready' || this.saving()) return;
    if (!this.session.authenticated() || this.session.user()?.role !== 'Admin') {
      this.message.set('An Admin session is required.');
      return;
    }
    const errors = validateLesson(this.draft);
    if (!this.levels().some((level) => level.id === this.draft.levelId))
      errors.levelId = 'Choose an available JLPT level.';
    this.fields.set(errors);
    this.message.set('');
    if (
      Object.keys(errors).length ||
      !positiveInteger(this.draft.levelId) ||
      !positiveInteger(this.draft.lessonNumber) ||
      !positiveInteger(this.draft.displayOrder) ||
      typeof this.draft.title !== 'string'
    )
      return;
    this.saving.set(true);
    const body: LessonWriteRequest = {
      levelId: this.draft.levelId,
      lessonNumber: this.draft.lessonNumber,
      displayOrder: this.draft.displayOrder,
      title: this.draft.title,
      description: this.draft.description === '' ? null : this.draft.description,
    };
    const request =
      this.id === null ? this.service.createLesson(body) : this.service.updateLesson(this.id, body);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.saving.set(false);
        this.baseline = JSON.stringify(this.draft);
        void this.router.navigate(['/admin/lessons'], {
          queryParams: {
            level: this.levels().find((level) => level.id === response.data.levelId)?.code ?? 'N5',
          },
        });
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.message.set(lessonError(error));
        if (error instanceof ApiError) {
          const fields: LessonFieldErrors = {};
          for (const detail of error.details) {
            const field = detail.field.split('.').pop();
            if (
              field === 'levelId' ||
              field === 'lessonNumber' ||
              field === 'title' ||
              field === 'description' ||
              field === 'displayOrder'
            )
              fields[field] = detail.message;
          }
          this.fields.set(fields);
        }
      },
    });
  }
}
