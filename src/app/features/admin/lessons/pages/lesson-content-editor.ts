import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, startWith, Subject, switchMap, tap } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { AuthSession } from '../../../../core/auth/auth-session.service';
import { GrammarBlockEditor } from '../components/grammar-block-editor';
import { GrammarPreview } from '../components/grammar-preview';
import {
  GrammarBlock,
  GrammarDocument,
  LessonContentSnapshot,
} from '../models/grammar-content.model';
import { contentNeedsReload, grammarContentError } from '../models/grammar-content-error';
import {
  createGrammarBlock,
  GRAMMAR_BLOCK_TYPES,
  GrammarBlockType,
  GrammarValidationIssue,
  moveGrammarBlock,
  serializeGrammarDocument,
  validateGrammarDocument,
} from '../models/grammar-editing';
import { LessonMetadata, positiveInteger } from '../models/lesson.model';
import { AdminLessonService } from '../services/admin-lesson.service';
import { LessonContentService } from '../services/lesson-content.service';

@Component({
  selector: 'app-admin-lesson-content-editor',
  imports: [FormsModule, RouterLink, GrammarBlockEditor, GrammarPreview],
  templateUrl: './lesson-content-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonContentEditor {
  private readonly route = inject(ActivatedRoute);
  private readonly lessons = inject(AdminLessonService);
  private readonly content = inject(LessonContentService);
  private readonly session = inject(AuthSession);
  private readonly browserDocument = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  private readonly baseline = signal(serializeGrammarDocument({ blocks: [] }));
  readonly lesson = signal<LessonMetadata | null>(null);
  readonly draft = signal<GrammarDocument>({ blocks: [] });
  readonly revision = signal<{ readonly version: number; readonly etag: string } | null>(null);
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly operation = signal<'idle' | 'saving' | 'deleting'>('idle');
  readonly requiresReload = signal(false);
  readonly message = signal('');
  readonly success = signal('');
  readonly serverIssues = signal<readonly GrammarValidationIssue[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(
    () => this.draft().blocks.find((block) => block.id === this.selectedId()) ?? null,
  );
  readonly blockTypes = GRAMMAR_BLOCK_TYPES;
  addType: GrammarBlockType = 'paragraph';
  readonly dirty = computed(() => serializeGrammarDocument(this.draft()) !== this.baseline());
  readonly validation = computed(() =>
    validateGrammarDocument(this.draft(), this.revision()?.version ?? 0),
  );
  readonly authorized = computed(
    () => this.session.authenticated() && this.session.user()?.role === 'Admin',
  );
  readonly busy = computed(() => this.operation() !== 'idle');
  readonly locked = computed(() => this.busy() || this.state() !== 'ready' || !this.authorized());
  readonly canSave = computed(
    () => !this.locked() && !this.requiresReload() && !this.validation().length,
  );

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) =>
          this.reload.pipe(
            startWith(undefined),
            tap(() => {
              this.state.set('loading');
              this.message.set('');
              this.success.set('');
              this.serverIssues.set([]);
            }),
            switchMap(() => {
              const raw = params.get('lessonId');
              const id = raw && /^\d+$/.test(raw) ? Number(raw) : null;
              if (!positiveInteger(id))
                return of({ error: 'Invalid lesson ID. Return to the lesson list.' });
              return this.lessons.getLesson(id).pipe(
                switchMap((response) =>
                  this.content.getContent(id).pipe(
                    map((snapshot) => ({ lesson: response.data, snapshot })),
                    catchError((error: unknown) =>
                      error instanceof ApiError &&
                      error.status === 404 &&
                      error.code === 'LESSON_CONTENT_NOT_FOUND'
                        ? of({ lesson: response.data, snapshot: null })
                        : of({ error: grammarContentError(error) }),
                    ),
                  ),
                ),
                catchError((error: unknown) => of({ error: grammarContentError(error) })),
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
        this.lesson.set(result.lesson);
        this.applySnapshot(result.snapshot);
        this.state.set('ready');
      });
  }
  private applySnapshot(snapshot: LessonContentSnapshot | null): void {
    const document = snapshot?.document.content ?? { blocks: [] };
    this.draft.set(document);
    this.revision.set(
      snapshot ? { version: snapshot.document.version, etag: snapshot.etag } : null,
    );
    this.baseline.set(serializeGrammarDocument(document));
    this.requiresReload.set(false);
    this.selectedId.set(document.blocks[0]?.id ?? null);
    this.serverIssues.set([]);
  }
  addBlock(): void {
    if (
      this.locked() ||
      this.draft().blocks.length >= 200 ||
      !GRAMMAR_BLOCK_TYPES.includes(this.addType)
    )
      return;
    let id: string;
    do {
      id = `b-${crypto.randomUUID()}`;
    } while (this.draft().blocks.some((block) => block.id === id));
    const block = createGrammarBlock(this.addType, id);
    this.edit({ blocks: [...this.draft().blocks, block] });
    this.selectedId.set(id);
  }
  updateBlock(block: GrammarBlock): void {
    if (this.locked()) return;
    this.edit({
      blocks: this.draft().blocks.map((current) =>
        current.id === block.id && current.type === block.type ? block : current,
      ),
    });
  }
  removeBlock(id: string): void {
    if (this.locked()) return;
    const index = this.draft().blocks.findIndex((block) => block.id === id);
    const blocks = this.draft().blocks.filter((block) => block.id !== id);
    this.edit({ blocks });
    if (id === this.selectedId())
      this.selectedId.set(blocks[Math.min(index, blocks.length - 1)]?.id ?? null);
  }
  moveBlock(id: string, direction: -1 | 1): void {
    if (!this.locked()) this.edit(moveGrammarBlock(this.draft(), id, direction));
  }
  private edit(document: GrammarDocument): void {
    this.draft.set(document);
    this.success.set('');
    this.serverIssues.set([]);
  }
  save(): void {
    const lesson = this.lesson();
    if (!lesson || !this.canSave()) return;
    this.operation.set('saving');
    this.message.set('');
    this.success.set('');
    this.serverIssues.set([]);
    this.content
      .saveContent(lesson.id, this.draft(), this.revision())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (snapshot) => {
          const selectedId = this.selectedId();
          this.applySnapshot(snapshot);
          this.selectedId.set(selectedId);
          this.operation.set('idle');
          this.success.set(`Content saved. Version ${snapshot.document.version}.`);
        },
        error: (error: unknown) => this.mutationFailed(error),
      });
  }
  deleteContent(): void {
    const lesson = this.lesson();
    const revision = this.revision();
    if (!lesson || !revision || this.locked() || this.requiresReload()) return;
    if (
      !window.confirm(
        `Delete grammar content for “${lesson.title}”? Lesson metadata and assignments will be preserved. Any unsaved content changes will be discarded.`,
      )
    )
      return;
    this.operation.set('deleting');
    this.message.set('');
    this.success.set('');
    this.content
      .deleteContent(lesson.id, revision)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.applySnapshot(null);
          this.operation.set('idle');
          this.success.set('Grammar content deleted. Lesson metadata is unchanged.');
        },
        error: (error: unknown) => this.mutationFailed(error),
      });
  }
  private mutationFailed(error: unknown): void {
    this.operation.set('idle');
    this.message.set(grammarContentError(error));
    this.requiresReload.set(contentNeedsReload(error));
    if (error instanceof ApiError) this.serverIssues.set(error.details);
  }
  reloadServer(): void {
    if (
      this.busy() ||
      (this.dirty() &&
        !window.confirm(
          'Discard your local content draft and load the server version? Export the draft first if you need a copy.',
        ))
    )
      return;
    this.reload.next();
  }
  exportDraft(): void {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            schemaVersion: 1,
            expectedVersion: this.revision()?.version ?? 0,
            content: this.draft(),
          },
          null,
          2,
        ),
      ],
      { type: 'application/json;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const link = this.browserDocument.createElement('a');
    link.href = url;
    link.download = `lesson-${this.lesson()?.id ?? 'unknown'}-content-draft.json`;
    this.browserDocument.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }
  canLeave(): boolean {
    return (
      !this.busy() &&
      (!this.dirty() ||
        window.confirm(
          'Discard unsaved grammar content changes? Export your draft before leaving if needed.',
        ))
    );
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty() || this.busy()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
