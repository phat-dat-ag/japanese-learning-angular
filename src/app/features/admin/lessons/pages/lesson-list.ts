import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, startWith, Subject, switchMap } from 'rxjs';
import { AuthSession } from '../../../../core/auth/auth-session.service';
import { LESSON_LEVELS, LessonLevelCode, LessonMetadata } from '../models/lesson.model';
import { lessonError } from '../models/lesson-error';
import { AdminLessonService } from '../services/admin-lesson.service';

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; lessons: readonly LessonMetadata[] };

@Component({
  selector: 'app-admin-lesson-list',
  imports: [RouterLink],
  templateUrl: './lesson-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonList {
  private readonly service = inject(AdminLessonService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  readonly levels = LESSON_LEVELS;
  readonly deleting = signal<number | null>(null);
  readonly feedback = signal('');
  readonly level = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => LESSON_LEVELS.find((code) => code === params.get('level')) ?? 'N5'),
      distinctUntilChanged(),
    ),
    { initialValue: 'N5' as LessonLevelCode },
  );
  readonly state = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => LESSON_LEVELS.find((code) => code === params.get('level')) ?? 'N5'),
      distinctUntilChanged(),
      switchMap((level) =>
        this.reload.pipe(
          startWith(undefined),
          switchMap(() =>
            this.service.getLessons(level).pipe(
              map((response): ListState => ({ status: 'loaded', lessons: response.data })),
              catchError((error: unknown) =>
                of<ListState>({ status: 'error', message: lessonError(error) }),
              ),
              startWith<ListState>({ status: 'loading' }),
            ),
          ),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as ListState },
  );

  changeLevel(value: string): void {
    if (
      this.deleting() !== null ||
      !LESSON_LEVELS.some((code) => code === value) ||
      value === this.level()
    )
      return;
    this.feedback.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { level: value },
      queryParamsHandling: 'merge',
    });
  }
  retry(): void {
    this.reload.next();
  }
  deleteLesson(lesson: LessonMetadata): void {
    if (this.deleting() !== null) return;
    if (!this.session.authenticated() || this.session.user()?.role !== 'Admin') {
      this.feedback.set('An Admin session is required.');
      return;
    }
    if (
      !window.confirm(
        `Delete lesson ${lesson.lessonNumber}: ${lesson.title}? Optional grammar content will also be deleted. This cannot be undone.`,
      )
    )
      return;
    this.deleting.set(lesson.id);
    this.feedback.set('');
    this.service
      .deleteLesson(lesson.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(null);
          this.feedback.set('Lesson deleted.');
          this.retry();
        },
        error: (error: unknown) => {
          this.deleting.set(null);
          this.feedback.set(lessonError(error, true));
        },
      });
  }
}
