import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GrammarInlines, GrammarMark, validGrammarText } from '../models/grammar-content.model';

@Component({
  selector: 'app-grammar-inline-editor',
  imports: [FormsModule],
  templateUrl: './grammar-inline-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrammarInlineEditor {
  readonly inlines = input.required<GrammarInlines>();
  readonly label = input.required<string>();
  readonly locked = input(false);
  readonly changed = output<GrammarInlines>();
  readonly marks: readonly GrammarMark[] = ['bold', 'italic', 'underline'];
  readonly validText = validGrammarText;
  text(index: number, text: string): void {
    if (!this.locked())
      this.changed.emit(this.inlines().map((run, i) => (i === index ? { ...run, text } : run)));
  }
  toggle(index: number, mark: GrammarMark): void {
    if (this.locked()) return;
    this.changed.emit(
      this.inlines().map((run, i) =>
        i !== index
          ? run
          : {
              ...run,
              marks: run.marks.includes(mark)
                ? run.marks.filter((item) => item !== mark)
                : [...run.marks, mark],
            },
      ),
    );
  }
  add(): void {
    if (!this.locked() && this.inlines().length < 100)
      this.changed.emit([...this.inlines(), { text: '', marks: [] }]);
  }
  remove(index: number): void {
    if (!this.locked() && this.inlines().length > 1)
      this.changed.emit(this.inlines().filter((_, i) => i !== index));
  }
}
