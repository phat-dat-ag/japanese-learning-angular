import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, startWith, Subject, switchMap } from 'rxjs';

import { LessonCard } from '../../components/lesson-card/lesson-card';
import { FlashcardLesson } from '../../models/flashcard-lesson.model';
import { LessonService } from '../../services/lesson.service';

type LessonListState =
  | { readonly status: 'invalid' }
  | { readonly status: 'loading'; readonly levelId: string }
  | {
    readonly status: 'loaded';
    readonly levelId: string;
    readonly lessons: readonly FlashcardLesson[];
  }
  | { readonly status: 'error'; readonly levelId: string };

@Component({
  selector: 'app-lesson-list',
  imports: [LessonCard, RouterLink],
  templateUrl: './lesson-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonList {
  private readonly route = inject(ActivatedRoute);
  private readonly lessonService = inject(LessonService);
  private readonly reload = new Subject<void>();

  readonly state = toSignal(
    this.route.paramMap.pipe(
      map((params) => (params.get('level') ?? '').toLowerCase()),
      distinctUntilChanged(),
      switchMap((levelId) => {
        if (!/^n[1-5]$/.test(levelId)) {
          return of<LessonListState>({ status: 'invalid' });
        }
        return this.reload.pipe(
          startWith(undefined),
          switchMap(() =>
            this.lessonService.getLessons(levelId).pipe(
              map((response): LessonListState => ({
                status: 'loaded',
                levelId,
                lessons: response.data,
              })),
              catchError(() => of<LessonListState>({ status: 'error', levelId })),
              startWith<LessonListState>({ status: 'loading', levelId }),
            ),
          ),
        );
      }),
    ),
    { initialValue: { status: 'loading', levelId: '' } as LessonListState },
  );

  retry(): void {
    this.reload.next();
  }
}
