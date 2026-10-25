import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { AuthSession } from '../../../core/auth/auth-session.service';
import { learningError, uncertainWrite } from '../models/learning-error';
import {
  PersonalDetail,
  ReviewRating,
  ReviewRequest,
  SessionDetail,
} from '../models/learning.model';
import { FlashcardLearningService } from './flashcard-learning.service';
import { FlashcardSessionService } from './flashcard-session.service';

interface PendingReview {
  readonly sessionId: number;
  readonly itemId: number;
  readonly request: ReviewRequest;
}

// Page-owned state. No personal data or retry payload survives sign-out or page destruction.
@Injectable()
export class SessionPlayerState implements OnDestroy {
  private readonly api = inject(FlashcardSessionService);
  private readonly learning = inject(FlashcardLearningService);
  private readonly auth = inject(AuthSession);
  private generation = 0;
  private readonly cancelReads = new Subject<void>();
  private id = 0;
  readonly session = signal<SessionDetail | null>(null);
  readonly card = signal<PersonalDetail | null>(null);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly revealed = signal(false);
  readonly pending = signal<PendingReview | null>(null);
  readonly needsRefresh = signal(false);
  readonly item = computed(() => {
    const session = this.session();
    return session?.status === 'IN_PROGRESS' ? session.items[session.currentPosition] : undefined;
  });
  readonly canRate = computed(
    () =>
      !!this.item() &&
      !!this.card() &&
      this.revealed() &&
      !this.busy() &&
      !this.pending() &&
      !this.needsRefresh(),
  );

  ngOnDestroy(): void {
    this.generation++;
    this.cancelReads.next();
    this.cancelReads.complete();
  }

  async open(id: number): Promise<void> {
    this.id = id;
    this.generation++;
    this.cancelReads.next();
    this.pending.set(null);
    this.session.set(null);
    this.card.set(null);
    this.busy.set(false);
    await this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.busy()) return;
    const generation = this.generation;
    const revision = this.auth.revision;
    this.busy.set(true);
    this.message.set('');
    this.card.set(null);
    this.revealed.set(false);
    try {
      const { data } = await firstValueFrom(
        this.api.get(this.id).pipe(takeUntil(this.cancelReads)),
      );
      if (!this.current(generation, revision)) return;
      this.session.set(data);
      const pending = this.pending();
      // A GET can confirm acceptance without replaying a lost response.
      if (pending && data.items.find((i) => i.itemId === pending.itemId)?.completedAt)
        this.pending.set(null);
      if (data.status !== 'IN_PROGRESS') this.pending.set(null);
      this.needsRefresh.set(false);
      const item = data.items[data.currentPosition];
      if (data.status === 'IN_PROGRESS' && item) {
        const detail = await firstValueFrom(
          this.learning.detail(item.vocabularyId).pipe(takeUntil(this.cancelReads)),
        );
        if (!this.current(generation, revision)) return;
        this.card.set(detail.data);
      }
      if (this.pending())
        this.message.set(
          'The earlier rating is still unconfirmed. Retry that exact rating or refresh again.',
        );
    } catch (error) {
      if (this.current(generation, revision)) {
        this.message.set(learningError(error));
        this.needsRefresh.set(true);
      }
    } finally {
      if (this.current(generation, revision)) this.busy.set(false);
    }
  }

  async rate(rating: ReviewRating): Promise<void> {
    const item = this.item();
    if (!this.canRate() || !item) return;
    this.pending.set({
      sessionId: this.id,
      itemId: item.itemId,
      request: { rating, expectedProgressVersion: item.progress.version },
    });
    await this.retryReview();
  }

  async retryReview(): Promise<void> {
    const pending = this.pending();
    if (!pending || this.busy()) return;
    const generation = this.generation;
    const revision = this.auth.revision;
    this.busy.set(true);
    this.message.set('');
    try {
      await firstValueFrom(this.api.review(pending.sessionId, pending.itemId, pending.request));
      if (!this.current(generation, revision)) return;
      // Review results are immutable history; always read current session/progress separately.
      this.pending.set(null);
      this.needsRefresh.set(true);
      this.busy.set(false);
      await this.refresh();
    } catch (error) {
      if (this.current(generation, revision)) {
        if (!uncertainWrite(error)) this.pending.set(null);
        this.needsRefresh.set(true);
        this.message.set(learningError(error));
      }
    } finally {
      if (this.current(generation, revision)) this.busy.set(false);
    }
  }

  async abandon(): Promise<void> {
    if (this.busy() || this.session()?.status !== 'IN_PROGRESS') return;
    const generation = this.generation;
    const revision = this.auth.revision;
    this.busy.set(true);
    this.message.set('');
    try {
      const { data } = await firstValueFrom(this.api.abandon(this.id));
      if (!this.current(generation, revision)) return;
      this.session.set(data);
      this.pending.set(null);
      this.card.set(null);
      this.needsRefresh.set(false);
    } catch (error) {
      if (this.current(generation, revision)) {
        this.message.set(learningError(error));
        this.needsRefresh.set(true);
      }
    } finally {
      if (this.current(generation, revision)) this.busy.set(false);
    }
  }

  private current(generation: number, revision: number): boolean {
    return generation === this.generation && revision === this.auth.revision;
  }
}
