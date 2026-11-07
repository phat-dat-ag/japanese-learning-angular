import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, forkJoin, map, of, startWith, Subject, switchMap } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { GrammarContent } from '../components/grammar-content';
import { GrammarDocument } from '../models/grammar-content.model';
import { grammarReadError } from '../models/grammar-read-error';
import { LessonLevel, LessonMetadata, positiveInteger } from '../models/lesson.model';
import { LessonReadService } from '../services/lesson-read.service';

type ContentState =
  | { status: 'loading' | 'missing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; document: GrammarDocument };
type NavigationState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; previous: LessonMetadata | null; next: LessonMetadata | null };
type ReaderState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
    status: 'ready';
    lesson: LessonMetadata;
    level: LessonLevel;
    content: ContentState;
    navigation: NavigationState;
  };

@Component({
  selector: 'app-grammar-lesson-reader',
  imports: [RouterLink, GrammarContent],
  templateUrl: './grammar-lesson-reader.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrammarLessonReader {
  private readonly service = inject(LessonReadService);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly lessonHeading = viewChild<ElementRef<HTMLHeadingElement>>('lessonHeading');
  private readonly reload = new Subject<void>();
  private readonly contentReload = new Subject<void>();
  private readonly navigationReload = new Subject<void>();
  readonly state = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) =>
        this.reload.pipe(
          startWith(undefined),
          switchMap(() => {
            const raw = params.get('lessonId');
            const id = raw && /^\d+$/.test(raw) ? Number(raw) : null;

            if (!positiveInteger(id))
              return of<ReaderState>({
                status: 'error',
                message: 'Invalid lesson ID. Choose a lesson from the grammar list.',
              });

            return forkJoin({
              lesson: this.service.getLesson(id),
              levels: this.service.getLevels(),
            }).pipe(
              switchMap(({ lesson: response, levels }) => {
                const lesson = response.data;
                const level = levels.data.find((item) => item.id === lesson.levelId);

                if (!level)
                  return of<ReaderState>({
                    status: 'error',
                    message: 'This lesson belongs to an unavailable JLPT level.',
                  });

                afterNextRender(() => this.lessonHeading()?.nativeElement.focus(), {
                  injector: this.injector,
                });

                return combineLatest({
                  content: this.contentReload.pipe(
                    startWith(undefined),
                    switchMap(() =>
                      this.service.getContent(id).pipe(
                        map((response): ContentState => ({
                          status: 'ready',
                          document: response.data.content,
                        })),
                        catchError((error: unknown) =>
                          of<ContentState>(
                            error instanceof ApiError &&
                              error.status === 404 &&
                              error.code === 'LESSON_CONTENT_NOT_FOUND'
                              ? { status: 'missing' }
                              : { status: 'error', message: grammarReadError(error) },
                          ),
                        ),
                        startWith<ContentState>({ status: 'loading' }),
                      ),
                    ),
                  ),
                  navigation: this.navigationReload.pipe(
                    startWith(undefined),
                    switchMap(() =>
                      this.service.getLessons(level.code).pipe(
                        map((response): NavigationState => {
                          const lessons = response.data;

                          if (lessons.some((item) => item.levelId !== level.id))
                            throw ApiError.invalidResponse(200, response.meta);

                          const index = lessons.findIndex((item) => item.id === id);

                          return index < 0
                            ? {
                              status: 'error',
                              message:
                                'This lesson is no longer in the current level catalogue. Refresh navigation to check again.',
                            }
                            : {
                              status: 'ready',
                              previous: lessons[index - 1] ?? null,
                              next: lessons[index + 1] ?? null,
                            };
                        }),
                        catchError((error: unknown) =>
                          of<NavigationState>({
                            status: 'error',
                            message: grammarReadError(error),
                          }),
                        ),
                        startWith<NavigationState>({ status: 'loading' }),
                      ),
                    ),
                  ),
                }).pipe(
                  map(({ content, navigation }): ReaderState => ({
                    status: 'ready',
                    lesson,
                    level,
                    content,
                    navigation,
                  })),
                );
              }),
              catchError((error: unknown) =>
                of<ReaderState>({ status: 'error', message: grammarReadError(error) }),
              ),
              startWith<ReaderState>({ status: 'loading' }),
            );
          }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as ReaderState },
  );

  retry(): void {
    this.reload.next();
  }

  retryContent(): void {
    this.contentReload.next();
  }

  retryNavigation(): void {
    this.navigationReload.next();
  }
}
