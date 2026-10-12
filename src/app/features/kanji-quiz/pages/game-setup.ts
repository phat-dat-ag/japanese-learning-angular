import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, map, of, startWith, Subject, switchMap } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { QuizPlayerNav } from '../components/quiz-player-nav';
import { QuizGameConfig } from '../models/quiz-player.model';
import { QuizPlayerService } from '../services/quiz-player.service';

type ConfigState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly config: QuizGameConfig }
  | { readonly status: 'error' };

@Component({
  selector: 'app-quiz-game-setup',
  imports: [QuizPlayerNav, FormsModule, RouterLink],
  templateUrl: './game-setup.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameSetup {
  private readonly service = inject(QuizPlayerService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  readonly levelId = signal<number | null>(null);
  readonly lessonId = signal<number | null>(null);
  readonly questionCount = signal<number | null>(1);
  readonly submitting = signal(false);
  readonly attempted = signal(false);
  readonly error = signal('');
  readonly createdSessionId = signal<number | null>(null);
  readonly state = toSignal(
    this.reload.pipe(
      startWith(undefined),
      switchMap(() =>
        this.service.getConfig().pipe(
          map(({ data }): ConfigState => ({ status: 'loaded', config: data })),
          catchError(() => of<ConfigState>({ status: 'error' })),
          startWith<ConfigState>({ status: 'loading' }),
        ),
      ),
    ),
    { requireSync: true },
  );
  readonly config = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.config : null;
  });
  readonly lessons = computed(
    () =>
      this.config()?.lessons.filter(
        (lesson) => this.levelId() === null || lesson.levelId === this.levelId(),
      ) ?? [],
  );
  readonly availableCount = computed(() => {
    const config = this.config();
    if (!config) return 0;
    if (this.lessonId() !== null) {
      return this.lessons().find((lesson) => lesson.id === this.lessonId())?.questionCount ?? 0;
    }
    return this.levelId() === null
      ? config.totalQuestions
      : (config.levels.find((level) => level.id === this.levelId())?.questionCount ?? 0);
  });
  readonly maximumCount = computed(() =>
    Math.min(this.config()?.maxQuestionCount ?? 0, this.availableCount()),
  );
  readonly validation = computed(() => {
    const config = this.config();
    if (!config) return 'Wait for the quiz configuration to load.';
    if (!config.totalQuestions) return 'No playable questions are available.';
    if (this.levelId() !== null && !config.levels.some((level) => level.id === this.levelId())) {
      return 'Select an available JLPT level.';
    }
    if (
      this.lessonId() !== null &&
      !this.lessons().some((lesson) => lesson.id === this.lessonId())
    ) {
      return 'Select a lesson belonging to the selected level.';
    }
    const count = this.questionCount();
    return count === null || !Number.isInteger(count) || count < 1 || count > this.maximumCount()
      ? 'Enter a whole number from 1 to ' + this.maximumCount() + '.'
      : '';
  });

  selectLevel(id: number | null): void {
    this.levelId.set(id);
    if (!this.lessons().some((lesson) => lesson.id === this.lessonId())) this.lessonId.set(null);
  }

  retry(): void {
    if (this.submitting() || this.createdSessionId() !== null) return;
    this.error.set('');
    this.reload.next();
  }

  startGame(): void {
    if (this.submitting() || this.createdSessionId() !== null) return;
    this.attempted.set(true);
    if (this.validation()) return;
    const questionCount = this.questionCount();
    if (questionCount === null) return;
    this.submitting.set(true);
    this.error.set('');
    const levelId = this.levelId();
    const lessonId = this.lessonId();
    this.service
      .createSession({
        questionCount,
        ...(levelId === null ? {} : { levelId }),
        ...(lessonId === null ? {} : { lessonId }),
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        next: ({ data }) => {
          this.createdSessionId.set(data.sessionId);
          void this.router.navigate(['/kanji-quiz', 'sessions', data.sessionId]).then(
            (navigated) => {
              if (!navigated)
                this.error.set('Your session was created. Use Open session to continue.');
            },
            () => this.error.set('Your session was created. Use Open session to continue.'),
          );
        },
        error: (error: unknown) => this.error.set(this.creationError(error)),
      });
  }

  private creationError(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.status === 401) return 'Your sign-in has expired. Please sign in again.';
      if (error.status === 403) return 'Your account cannot start this quiz.';
      if (error.code === 'QUIZ_INSUFFICIENT_QUESTIONS') {
        return 'There are no longer enough matching questions. Refresh availability and adjust the question count.';
      }
      if (error.code === 'QUIZ_GAME_CONFLICT')
        return 'The question bank changed. Refresh availability and try again.';
      if (error.status === 400)
        return 'These settings are no longer valid. Refresh availability and check your selections.';
      if (error.status === 0 || error.code === 'INVALID_RESPONSE') {
        return 'Session creation could not be confirmed. Retrying may create another session.';
      }
    }
    return 'Unable to start the game. Please try again.';
  }
}
