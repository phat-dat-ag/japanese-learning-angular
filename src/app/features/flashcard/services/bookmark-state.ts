import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthSession } from '../../../core/auth/auth-session.service';
import { learningError } from '../models/learning-error';
import { FlashcardLearningService } from './flashcard-learning.service';

@Injectable()
export class BookmarkState implements OnDestroy {
  private readonly api = inject(FlashcardLearningService);
  private readonly auth = inject(AuthSession);
  private destroyed = false;
  readonly saving = signal<number | null>(null);
  readonly values = signal<ReadonlyMap<number, boolean>>(new Map());
  readonly error = signal('');
  ngOnDestroy(): void {
    this.destroyed = true;
  }
  async save(id: number, value: boolean): Promise<boolean> {
    if (this.saving() !== null) return false;
    const revision = this.auth.revision;
    this.saving.set(id);
    this.error.set('');
    try {
      const result = await firstValueFrom(this.api.bookmark(id, value));
      if (this.destroyed || revision !== this.auth.revision) return false;
      this.values.update((values) => new Map(values).set(id, result.data.bookmarked));
      return true;
    } catch (error) {
      if (!this.destroyed && revision === this.auth.revision) this.error.set(learningError(error));
      return false;
    } finally {
      if (!this.destroyed && revision === this.auth.revision) this.saving.set(null);
    }
  }
}
