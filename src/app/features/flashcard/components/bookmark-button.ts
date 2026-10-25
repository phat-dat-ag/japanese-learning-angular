import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-bookmark-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button
    type="button"
    [attr.aria-pressed]="bookmarked()"
    [disabled]="busy()"
    (click)="changed.emit(!bookmarked())"
    class="rounded-lg border border-indigo-200 px-3 py-2 text-sm text-indigo-700 focus-visible:outline-2 disabled:opacity-50"
  >
    {{ bookmarked() ? 'Remove bookmark' : 'Bookmark' }}
  </button>`,
})
export class BookmarkButton {
  readonly vocabularyId = input.required<number>();
  readonly bookmarked = input.required<boolean>();
  readonly busy = input(false);
  readonly changed = output<boolean>();
}
