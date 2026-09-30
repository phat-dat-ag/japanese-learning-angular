import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AdditionState } from '../models/vocabulary-add-state';

@Component({
  selector: 'app-vocabulary-add-feedback',
  template: `
    @if (state(); as current) {
      @switch (current.status) {
        @case ('saving') {
          <p role="status" class="mt-4 text-sm text-indigo-700">Saving {{ kind() }}…</p>
        }
        @case ('refreshing') {
          <p role="status" class="mt-4 text-sm text-indigo-700">
            Addition saved. Refreshing details…
          </p>
        }
        @case ('saved') {
          <p role="status" class="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">
            {{ kind() }} added.
          </p>
        }
        @case ('error') {
          <p
            role="alert"
            class="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {{ current.message }}
          </p>
        }
        @case ('refresh-error') {
          <div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p role="alert" class="text-sm text-amber-900">
              The addition was saved, but the latest details could not be loaded. Refresh before
              adding again.
            </p>
            <button
              type="button"
              (click)="retried.emit()"
              class="mt-3 min-h-11 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Refresh saved details
            </button>
          </div>
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyAddFeedback {
  readonly state = input.required<AdditionState>();
  readonly kind = input.required<string>();
  readonly retried = output<void>();
}
