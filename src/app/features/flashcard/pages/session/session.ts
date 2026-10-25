import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Flashcard } from '../../components/flashcard/flashcard';
import { BookmarkButton } from '../../components/bookmark-button';
import { SessionPlayerState } from '../../services/session-player-state';
import { ReviewRating } from '../../models/learning.model';
import { BookmarkState } from '../../services/bookmark-state';
import { LearningNav } from '../../components/learning-nav';

@Component({
  selector: 'app-learning-session',
  imports: [RouterLink, Flashcard, BookmarkButton, LearningNav],
  providers: [SessionPlayerState, BookmarkState],
  host: { '(window:focus)': 'refresh()' },
  templateUrl: './session.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LearningSession {
  readonly bookmarks = inject(BookmarkState);
  readonly player = inject(SessionPlayerState);
  readonly invalid = signal(false);
  readonly confirmingAbandon = signal(false);
  readonly ratings: readonly ReviewRating[] = ['AGAIN', 'HARD', 'GOOD', 'EASY'];
  refresh(): void {
    this.bookmarks.values.set(new Map());
    if (!this.invalid()) void this.player.refresh();
  }
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  constructor() {
    let previousFocus = '';
    afterRenderEffect(() => {
      const card = this.player.card();
      const message = this.player.message();
      const status = this.player.session()?.status;
      if (this.player.busy()) return;
      const focusKey = message || String(card?.vocabulary.id ?? status);
      if (focusKey === previousFocus) return;
      previousFocus = focusKey;
      const selector = message ? '[data-session-error]' : card ? '.flip-control' : 'h1';
      this.element.nativeElement.querySelector<HTMLElement>(selector)?.focus();
    });
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const raw = params.get('sessionId') ?? '';
        const id = Number(raw);
        const valid = /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(id);
        this.invalid.set(!valid);
        this.confirmingAbandon.set(false);
        if (valid) void this.player.open(id);
      });
  }
}
