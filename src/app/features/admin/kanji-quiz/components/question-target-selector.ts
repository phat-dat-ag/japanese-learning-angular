import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { selectedTarget } from '../models/question-form.model';

@Component({
  selector: 'app-question-target-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label for="target-preview" class="block font-medium text-gray-800"
      >Select a target in the sentence</label
    >
    <p id="selection-help" class="mt-1 text-sm text-gray-600">
      Highlight kana with the mouse, or use Shift + Arrow keys, then choose Use selection. Indices
      count Unicode code points.
    </p>
    <textarea
      #preview
      id="target-preview"
      [value]="sentence()"
      readonly
      rows="3"
      lang="ja"
      aria-describedby="selection-help selection-feedback"
      (select)="capture(preview)"
      (keyup)="capture(preview)"
      (mouseup)="capture(preview)"
      class="mt-2 w-full rounded-xl border border-gray-300 p-3 text-lg focus-visible:outline-indigo-600"
    ></textarea>
    <button
      type="button"
      [disabled]="disabled() || !selection()"
      (click)="useSelection()"
      class="min-h-11 rounded-xl border border-indigo-200 px-4 font-semibold text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50"
    >
      Use selection
    </button>
    <p id="selection-feedback" role="status" class="mt-2 text-sm text-gray-700">
      @if (selection(); as target) {
        Selected: {{ target.targetReading }} (start {{ target.targetStart }}, length
        {{ target.targetLength }})
      }
    </p>
  `,
})
export class QuestionTargetSelector {
  readonly sentence = input.required<string>();
  readonly disabled = input(false);
  readonly selected = output<NonNullable<ReturnType<typeof selectedTarget>>>();
  private readonly captured = signal<{ sentence: string; start: number; end: number } | null>(null);
  readonly selection = computed(() => {
    const value = this.captured();
    return value?.sentence === this.sentence()
      ? selectedTarget(value.sentence, value.start, value.end)
      : null;
  });
  capture(element: HTMLTextAreaElement): void {
    this.captured.set({
      sentence: element.value,
      start: element.selectionStart,
      end: element.selectionEnd,
    });
  }
  useSelection(): void {
    const value = this.selection();
    if (!this.disabled() && value) this.selected.emit(value);
  }
}
