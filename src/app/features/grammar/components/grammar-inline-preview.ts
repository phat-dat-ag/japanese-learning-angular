import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GrammarInlines } from '../models/grammar-content.model';

@Component({
  selector: 'app-grammar-inline-preview',
  template: `@for (run of inlines(); track $index) {
    <span
      class="whitespace-pre-wrap break-words"
      [class.font-bold]="run.marks.includes('bold')"
      [class.italic]="run.marks.includes('italic')"
      [class.underline]="run.marks.includes('underline')"
      >{{ run.text }}</span
    >
  }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrammarInlinePreview {
  readonly inlines = input.required<GrammarInlines>();
}
