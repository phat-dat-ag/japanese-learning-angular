import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  catchError,
  distinctUntilChanged,
  exhaustMap,
  map,
  Observable,
  of,
  startWith,
  Subject,
  switchMap,
} from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { QuizAnswer, QuizPlayerQuestion, QuizSession } from '../models/quiz-gameplay.model';
import { QuizPlayerService } from '../services/quiz-player.service';

interface QuestionState {
  readonly status: 'question';
  readonly session: QuizSession;
  readonly question: QuizPlayerQuestion;
  readonly selectedOptionId: number | null;
  readonly feedback: QuizAnswer | null;
  readonly submitting: boolean;
}

type GameplayState =
  | { readonly status: 'loading' | 'invalid' | 'completed' | 'abandoned' | 'finishing' }
  | { readonly status: 'error'; readonly message: string; readonly retryable: boolean }
  | { readonly status: 'empty'; readonly session: QuizSession }
  | QuestionState;

type Action =
  | { readonly kind: 'load' }
  | { readonly kind: 'answer'; readonly current: QuestionState; readonly optionId: number }
  | { readonly kind: 'finish' };

@Component({
  selector: 'app-quiz-gameplay',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gameplay.html',
})
export class Gameplay {
  private readonly service = inject(QuizPlayerService);
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');
  private readonly actions = new Subject<Action>();
  readonly sessionId = signal<number | null>(null);
  readonly state = signal<GameplayState>({ status: 'loading' });
  readonly questionState = computed(() => {
    const state = this.state();
    return state.status === 'question' ? state : null;
  });
  readonly sentence = computed(() => {
    const question = this.questionState()?.question;
    if (!question) return null;
    const points = Array.from(question.sentenceReading);
    const end = question.targetStart + question.targetLength;
    return {
      before: points.slice(0, question.targetStart).join(''),
      target: points.slice(question.targetStart, end).join(''),
      after: points.slice(end).join(''),
    };
  });

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(
        map((params) => {
          const value = params.get('sessionId');
          return value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))
            ? Number(value)
            : null;
        }),
        distinctUntilChanged(),
        // Changing sessions cancels both reads and writes and discards their late responses.
        switchMap((id) => {
          this.sessionId.set(id);
          if (id === null) return of<GameplayState>({ status: 'invalid' });
          return this.actions.pipe(
            startWith<Action>({ kind: 'load' }),
            // Only one operation can run at a time, including rapid clicks before rendering.
            exhaustMap((action) =>
              this.perform(id, action).pipe(
                catchError((error: unknown) => of(this.errorState(error, action.kind))),
              ),
            ),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((state) => {
        this.state.set(state);
        afterNextRender(() => this.heading()?.nativeElement.focus(), { injector: this.injector });
      });
  }

  selectOption(id: number): void {
    const current = this.questionState();
    if (
      !current ||
      current.submitting ||
      current.feedback ||
      !current.question.options.some((option) => option.id === id)
    )
      return;
    this.state.set({ ...current, selectedOptionId: id });
  }

  submitAnswer(): void {
    const current = this.questionState();
    if (!current || current.submitting || current.feedback || current.selectedOptionId === null)
      return;
    this.actions.next({ kind: 'answer', current, optionId: current.selectedOptionId });
  }

  nextQuestion(): void {
    if (!this.questionState()?.feedback) return;
    this.actions.next({ kind: 'load' });
  }

  retry(): void {
    const state = this.state();
    if ((state.status === 'error' && state.retryable) || state.status === 'empty') {
      this.actions.next({ kind: 'load' });
    }
  }

  finishGame(): void {
    const state = this.state();
    if (state.status !== 'empty' || state.session.answeredCount !== state.session.questionCount)
      return;
    if (!window.confirm('Finish this game? All answers have been submitted.')) return;
    this.actions.next({ kind: 'finish' });
  }

  private perform(id: number, action: Action): Observable<GameplayState> {
    if (action.kind === 'load') {
      this.state.set({ status: 'loading' });
      return this.loadSession(id);
    }
    if (action.kind === 'finish') {
      this.state.set({ status: 'finishing' });
      return this.service.finishSession(id).pipe(map(() => ({ status: 'completed' })));
    }
    const current = action.current;
    this.state.set({ ...current, submitting: true });
    return this.service
      .submitAnswer(id, {
        sessionQuestionId: current.question.sessionQuestionId,
        selectedOptionId: action.optionId,
      })
      .pipe(
        map(({ data, meta }): GameplayState => {
          if (!current.question.options.some((option) => option.id === data.correctOptionId)) {
            throw ApiError.invalidResponse(200, meta);
          }
          return { ...current, submitting: false, feedback: data };
        }),
      );
  }

  private loadSession(id: number): Observable<GameplayState> {
    return this.service.getSession(id).pipe(
      switchMap(({ data: session }) => {
        if (session.status === 'COMPLETED') return of<GameplayState>({ status: 'completed' });
        if (session.status === 'ABANDONED') return of<GameplayState>({ status: 'abandoned' });
        return this.service.getNextQuestion(id).pipe(
          map(({ data, meta }): GameplayState => {
            if (data.status !== session.status) {
              throw new ApiError(
                'SESSION_CHANGED',
                'Session changed during loading.',
                409,
                [],
                meta,
              );
            }
            if (!data.question) return { status: 'empty', session };
            return {
              status: 'question',
              session,
              question: data.question,
              selectedOptionId: null,
              feedback: null,
              submitting: false,
            };
          }),
        );
      }),
    );
  }

  private errorState(error: unknown, operation: Action['kind']): GameplayState {
    if (error instanceof ApiError) {
      if (error.status === 401)
        return {
          status: 'error',
          message: 'Your sign-in has expired. Please sign in again.',
          retryable: false,
        };
      if (error.status === 403 || error.status === 404) {
        return {
          status: 'error',
          message: 'This session is unavailable to your account.',
          retryable: false,
        };
      }
      if (error.status === 409) {
        return {
          status: 'error',
          message: 'The session has changed. Reload the session to continue.',
          retryable: true,
        };
      }
    }
    return {
      status: 'error',
      retryable: true,
      message:
        operation === 'load'
          ? 'Unable to load the session. Check your connection and retry.'
          : 'The request could not be confirmed. Reload the session before trying again.',
    };
  }
}
