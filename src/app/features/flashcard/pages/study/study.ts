import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, startWith, Subject, switchMap } from 'rxjs';

import { FlashcardLesson } from '../../models/flashcard-lesson.model';
import { LessonService } from '../../services/lesson.service';

type StudyState =
  | { readonly status: 'loading'; readonly levelId: string }
  | { readonly status: 'loaded'; readonly levelId: string; readonly lesson: FlashcardLesson }
  | { readonly status: 'missing'; readonly levelId: string }
  | { readonly status: 'error'; readonly levelId: string };

@Component({
  selector: 'app-study',
  imports: [RouterLink],
  templateUrl: './study.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Study {
  private readonly route = inject(ActivatedRoute);
  private readonly lessonService = inject(LessonService);
  private readonly reload = new Subject<void>();

  readonly state = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const levelId = (params.get('level') ?? '').toLowerCase();
        const lessonId = Number(params.get('lessonId'));
        if (!/^n[1-5]$/.test(levelId) || !Number.isSafeInteger(lessonId) || lessonId <= 0) {
          return of<StudyState>({ status: 'missing', levelId });
        }
        return this.reload.pipe(
          startWith(undefined),
          switchMap(() =>
            this.lessonService.getLessons(levelId).pipe(
              map((response): StudyState => {
                const lesson = response.data.find((item) => item.id === lessonId);
                return lesson
                  ? { status: 'loaded', levelId, lesson }
                  : { status: 'missing', levelId };
              }),
              catchError(() => of<StudyState>({ status: 'error', levelId })),
              startWith<StudyState>({ status: 'loading', levelId }),
            ),
          ),
        );
      }),
    ),
    { initialValue: { status: 'loading', levelId: '' } as StudyState },
  );

  retry(): void {
    this.reload.next();
  }
}
