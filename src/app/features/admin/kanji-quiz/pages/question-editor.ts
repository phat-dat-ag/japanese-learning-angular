import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, skip, startWith, Subject, switchMap, takeUntil, tap } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { VocabularyExample } from '../../vocabulary/models/vocabulary-detail.model';
import { VocabularyService } from '../../vocabulary/services/vocabulary.service';
import { QuestionForm } from '../components/question-form';
import { QuestionErrors, QuestionField, positiveId } from '../models/question-form.model';
import { QuizQuestionCreateRequest, QuizQuestionResponse } from '../models/quiz-question.model';
import { QuizQuestionService } from '../services/quiz-question.service';

type EditorState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; question: QuizQuestionResponse | null };
type SaveState =
  | { status: 'idle' | 'saving' | 'saved' }
  | { status: 'error' | 'conflict'; message: string; fields: QuestionErrors };
type ExampleState =
  | { status: 'loading' }
  | { status: 'ready'; examples: readonly VocabularyExample[]; message: string };

@Component({
  selector: 'app-question-editor',
  imports: [RouterLink, QuestionForm],
  templateUrl: './question-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class QuestionEditor {
  private readonly service = inject(QuizQuestionService);
  private readonly vocabulary = inject(VocabularyService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  private readonly lookupChanges = new Subject<number | null>();
  readonly formComponent = viewChild(QuestionForm);
  readonly state = signal<EditorState>({ status: 'loading' });
  readonly saveState = signal<SaveState>({ status: 'idle' });
  readonly created = signal<QuizQuestionResponse | null>(null);
  readonly exampleState = toSignal(
    this.lookupChanges.pipe(
      startWith(null),
      switchMap((id) => {
        if (!positiveId(id))
          return of<ExampleState>({ status: 'ready', examples: [], message: '' });
        return this.vocabulary.getVocabularyDetail(id).pipe(
          map((response): ExampleState => ({
            status: 'ready',
            examples: response.data.examples,
            message: response.data.examples.length ? '' : 'This vocabulary has no examples.',
          })),
          catchError(() =>
            of<ExampleState>({
              status: 'ready',
              examples: [],
              message:
                'Unable to load examples. Check the vocabulary ID and choose Load examples to retry.',
            }),
          ),
          startWith<ExampleState>({ status: 'loading' }),
        );
      }),
    ),
    { requireSync: true },
  );

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) =>
          this.reload.pipe(
            startWith(undefined),
            tap(() => {
              this.saveState.set({ status: 'idle' });
              this.created.set(null);
              this.lookupChanges.next(null);
            }),
            switchMap(() => {
              const raw = params.get('questionId');
              if (raw === null) return of<EditorState>({ status: 'ready', question: null });
              const id = Number(raw);
              if (!/^\d+$/.test(raw) || !positiveId(id))
                return of<EditorState>({
                  status: 'error',
                  message: 'Invalid question ID. Return to the Question Bank.',
                });
              return this.service.getQuestion(id).pipe(
                map((response): EditorState => {
                  if (response.data.id !== id) throw ApiError.invalidResponse(200, response.meta);
                  return { status: 'ready', question: response.data };
                }),
                catchError((error: unknown) =>
                  of<EditorState>({ status: 'error', message: this.loadError(error) }),
                ),
                startWith<EditorState>({ status: 'loading' }),
              );
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) => this.state.set(state));
  }

  fields(): QuestionErrors {
    const save = this.saveState();
    return save.status === 'error' || save.status === 'conflict' ? save.fields : {};
  }

  locked(): boolean {
    const state = this.state();
    return (
      this.saveState().status === 'saving' ||
      this.saveState().status === 'conflict' ||
      (state.status === 'ready' && state.question?.status === 'ARCHIVED')
    );
  }

  lookup(id: number | null): void {
    this.lookupChanges.next(id);
  }

  save(request: QuizQuestionCreateRequest): void {
    const state = this.state();
    if (state.status !== 'ready' || this.locked() || this.created()) return;
    const question = state.question;
    if (question && request.content.sourceType !== question.sourceType) return;
    this.saveState.set({ status: 'saving' });
    const operation = question
      ? this.service.updateQuestion(question.id, {
        version: question.version,
        content: request.content,
      })
      : this.service.createQuestion(request);
    operation
      .pipe(takeUntil(this.route.paramMap.pipe(skip(1))), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (question && response.data.id !== question.id) {
            this.saveState.set(this.saveError(ApiError.invalidResponse(200, response.meta), true));
            return;
          }
          this.formComponent()?.form.markAsPristine();
          if (question) this.state.set({ status: 'ready', question: response.data });
          else this.created.set(response.data);
          this.saveState.set({ status: 'saved' });
        },
        error: (error: unknown) => this.saveState.set(this.saveError(error, !!question)),
      });
  }

  reloadQuestion(): void {
    if (this.saveState().status === 'saving') return;
    if (
      this.formComponent()?.form.dirty &&
      !window.confirm('Discard unsaved changes and reload the latest question?')
    )
      return;
    this.reload.next();
  }

  canLeave(): boolean {
    if (this.saveState().status === 'saving') return false;
    return !this.formComponent()?.form.dirty || window.confirm('Discard unsaved question changes?');
  }

  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.saveState().status === 'saving' || this.formComponent()?.form.dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  private loadError(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.status === 404)
        return 'This question no longer exists. Return to the Question Bank.';
      if (error.status === 401) return 'Your session could not be verified. Please sign in again.';
      if (error.status === 403) return 'You do not have permission to view this question.';
    }
    return 'Unable to load the question. Please try again.';
  }

  private saveError(error: unknown, editing: boolean): SaveState {
    const fields: QuestionErrors = {};
    let message =
      'Unable to confirm the save. Your changes are retained. Check the Question Bank before retrying; the request may have completed.';
    if (error instanceof ApiError) {
      if (error.status === 400) {
        message = 'The server rejected some values. Check the highlighted fields and try again.';
        const known: readonly QuestionField[] = [
          'sourceType',
          'exampleId',
          'vocabularyId',
          'sentenceReading',
          'targetStart',
          'targetLength',
          'targetReading',
          'explanationVi',
          'explanationEn',
          'levelIds',
          'lessonIds',
          'options',
          'correctIndex',
        ];
        for (const detail of error.details) {
          for (const field of known) {
            if (detail.field.split(/[.\[\]]/).includes(field))
              fields[field] = 'The server rejected this value. Check it and try again.';
          }
          if (detail.field === 'target') {
            fields.targetStart = 'Check the target range against the current source.';
            fields.targetLength = fields.targetStart;
          }
          if (detail.field === 'source')
            fields.exampleId = 'Check the source reference and question type.';
        }
      }
      if (error.status === 401)
        message = 'Your session could not be verified. Please sign in again.';
      if (error.status === 403) message = 'You do not have permission to save this question.';
      if (error.status === 404)
        message =
          'The question or a referenced example, vocabulary, level, or lesson no longer exists. Check the references or return to the Question Bank.';
      if (error.status === 409)
        return {
          status: editing ? 'conflict' : 'error',
          fields,
          message: editing
            ? 'The question changed, is no longer editable, or duplicates another source and target. Your changes are retained. Reload the latest version before saving again.'
            : 'A question with this source and target may already exist, or a reference changed. Check the Question Bank and your source before retrying.',
        };
    }
    return { status: 'error', message, fields };
  }
}
