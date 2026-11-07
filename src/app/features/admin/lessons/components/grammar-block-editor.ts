import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GrammarBlock, GrammarInlines, validGrammarText } from '../models/grammar-content.model';
import { emptyInlines } from '../models/grammar-editing';
import { GrammarInlineEditor } from './grammar-inline-editor';

@Component({
  selector: 'app-grammar-block-editor',
  imports: [FormsModule, GrammarInlineEditor],
  templateUrl: './grammar-block-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrammarBlockEditor {
  readonly block = input.required<GrammarBlock>();
  readonly locked = input(false);
  readonly changed = output<GrammarBlock>();
  readonly headingLevels = [1, 2, 3, 4, 5, 6] as const;
  readonly variants = ['note', 'tip', 'warning', 'information'] as const;
  readonly exampleFields = ['japanese', 'reading', 'vi', 'en'] as const;
  readonly exampleLabels = {
    japanese: 'Japanese text',
    reading: 'Reading',
    vi: 'Vietnamese translation',
    en: 'English translation',
  };
  readonly validText = validGrammarText;
  private emit(block: GrammarBlock): void {
    if (!this.locked()) this.changed.emit(block);
  }
  inline(value: GrammarInlines): void {
    const block = this.block();
    if ('inlines' in block) this.emit({ ...block, inlines: value });
  }
  heading(value: number): void {
    const block = this.block();
    const level = this.headingLevels.find((item) => item === value);
    if (block.type === 'heading' && level) this.emit({ ...block, level });
  }
  variant(value: string): void {
    const block = this.block();
    const variant = this.variants.find((item) => item === value);
    if (block.type === 'callout' && variant) this.emit({ ...block, variant });
  }
  example(field: 'japanese' | 'reading' | 'vi' | 'en', value: string): void {
    const block = this.block();
    if (block.type !== 'example') return;
    this.emit(
      field === 'en' || field === 'vi'
        ? { ...block, translations: { ...block.translations, [field]: value } }
        : { ...block, [field]: value },
    );
  }
  ordered(ordered: boolean): void {
    const block = this.block();
    if (block.type === 'list') this.emit({ ...block, ordered });
  }
  listItem(index: number, value: GrammarInlines): void {
    const block = this.block();
    if (block.type === 'list')
      this.emit({ ...block, items: block.items.map((item, i) => (i === index ? value : item)) });
  }
  addItem(): void {
    const block = this.block();
    if (block.type === 'list' && block.items.length < 100)
      this.emit({ ...block, items: [...block.items, emptyInlines()] });
  }
  removeItem(index: number): void {
    const block = this.block();
    if (block.type === 'list' && block.items.length > 1)
      this.emit({ ...block, items: block.items.filter((_, i) => i !== index) });
  }
  headers(enabled: boolean): void {
    const block = this.block();
    if (block.type === 'table')
      this.emit({ ...block, headers: enabled ? block.rows[0].map(() => emptyInlines()) : [] });
  }
  updateCell(row: number | null, column: number, value: GrammarInlines): void {
    const block = this.block();
    if (block.type !== 'table') return;
    this.emit(
      row === null
        ? { ...block, headers: block.headers.map((cell, i) => (i === column ? value : cell)) }
        : {
            ...block,
            rows: block.rows.map((cells, i) =>
              i === row ? cells.map((cell, j) => (j === column ? value : cell)) : cells,
            ),
          },
    );
  }
  addRow(): void {
    const block = this.block();
    if (block.type === 'table' && block.rows.length < 100)
      this.emit({ ...block, rows: [...block.rows, block.rows[0].map(() => emptyInlines())] });
  }
  removeRow(index: number): void {
    const block = this.block();
    if (block.type === 'table' && block.rows.length > 1)
      this.emit({ ...block, rows: block.rows.filter((_, i) => i !== index) });
  }
  addColumn(): void {
    const block = this.block();
    if (block.type !== 'table' || block.rows[0].length >= 20) return;
    this.emit({
      ...block,
      headers: block.headers.length ? [...block.headers, emptyInlines()] : [],
      rows: block.rows.map((row) => [...row, emptyInlines()]),
    });
  }
  removeColumn(index: number): void {
    const block = this.block();
    if (block.type !== 'table' || block.rows[0].length <= 1) return;
    this.emit({
      ...block,
      headers: block.headers.filter((_, i) => i !== index),
      rows: block.rows.map((row) => row.filter((_, i) => i !== index)),
    });
  }
}
