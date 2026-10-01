import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-vocabulary-form-actions',
  host: { class: 'block border-t border-gray-100 pt-5' },
  template: `
    <div class="flex flex-wrap gap-3">
      <button
        type="submit"
        [disabled]="locked() || invalid()"
        class="min-h-11 w-full rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {{ saveLabel() }}
      </button>
      <button
        type="button"
        [disabled]="locked()"
        (click)="cancelled.emit()"
        class="min-h-11 w-full rounded-xl border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        Cancel
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyFormActions {
  readonly saveLabel = input.required<string>();
  readonly locked = input(false);
  readonly invalid = input(false);
  readonly cancelled = output<void>();
}
