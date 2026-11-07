import { TestBed } from '@angular/core/testing';
import { GrammarBlock, GrammarInlines, isGrammarDocument } from '../models/grammar-content.model';
import { createGrammarBlock, GRAMMAR_BLOCK_TYPES } from '../models/grammar-editing';
import { grammarDocumentFixture, grammarInlines } from '../testing/grammar-content.fixture';
import { GrammarBlockEditor } from './grammar-block-editor';
import { GrammarInlineEditor } from './grammar-inline-editor';
import { GrammarPreview } from './grammar-preview';

describe('Grammar inline editor', () => {
  it('edits text and all three marks through accessible controls without mutating inputs', async () => {
    const fixture = TestBed.createComponent(GrammarInlineEditor);
    const initial: GrammarInlines = [{ text: '日本語', marks: [] }];
    fixture.componentRef.setInput('inlines', initial);
    fixture.componentRef.setInput('label', 'Paragraph text');
    fixture.componentInstance.changed.subscribe((value) =>
      fixture.componentRef.setInput('inlines', value),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    const text: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    text.value = '日本語 — Tiếng Việt';
    text.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    for (const button of fixture.nativeElement.querySelectorAll('button[aria-pressed]'))
      button.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.inlines()[0]).toEqual({
      text: '日本語 — Tiếng Việt',
      marks: ['bold', 'italic', 'underline'],
    });
    expect(initial[0].text).toBe('日本語');
    expect(initial[0].marks).toEqual([]);
    expect(fixture.nativeElement.querySelectorAll('[aria-pressed="true"]')).toHaveLength(3);
    fixture.componentInstance.add();
    fixture.detectChanges();
    expect(fixture.componentInstance.inlines()).toHaveLength(2);
    fixture.componentInstance.remove(1);
    fixture.detectChanges();
    expect(fixture.componentInstance.inlines()).toHaveLength(1);
    fixture.componentInstance.remove(0);
    expect(fixture.componentInstance.inlines()).toHaveLength(1);
    fixture.componentRef.setInput('locked', true);
    fixture.detectChanges();
    fixture.componentInstance.toggle(0, 'bold');
    expect(fixture.componentInstance.inlines()[0].marks).toHaveLength(3);
  });
});
describe('Grammar block editor', () => {
  function setup(block: GrammarBlock) {
    const fixture = TestBed.createComponent(GrammarBlockEditor);
    fixture.componentRef.setInput('block', block);
    fixture.componentInstance.changed.subscribe((value) =>
      fixture.componentRef.setInput('block', value),
    );
    fixture.detectChanges();
    return fixture;
  }
  it.each(GRAMMAR_BLOCK_TYPES)('renders editable controls for %s', (type) => {
    const fixture = setup(createGrammarBlock(type, 'stable'));
    expect(fixture.nativeElement.textContent).toContain(type);
    expect(fixture.nativeElement.querySelector('[contenteditable]')).toBeNull();
  });
  it('edits heading levels, callout variants and all example languages', () => {
    const fixture = setup(createGrammarBlock('heading', 'h'));
    const page = fixture.componentInstance;
    page.heading(6);
    fixture.detectChanges();
    expect(page.block()).toMatchObject({ level: 6, id: 'h' });
    fixture.componentRef.setInput('block', createGrammarBlock('callout', 'c'));
    fixture.detectChanges();
    page.variant('warning');
    page.inline(grammarInlines);
    fixture.detectChanges();
    expect(page.block()).toMatchObject({ variant: 'warning', inlines: grammarInlines });
    fixture.componentRef.setInput('block', createGrammarBlock('example', 'e'));
    fixture.detectChanges();
    page.example('japanese', '私は学生です。');
    page.example('reading', 'わたしはがくせいです。');
    page.example('vi', 'Tôi là học sinh.');
    page.example('en', 'I am a student.');
    fixture.detectChanges();
    expect(isGrammarDocument({ blocks: [page.block()] })).toBe(true);
  });
  it('adds/removes list items while preserving the minimum and maximum', () => {
    const fixture = setup(createGrammarBlock('list', 'l'));
    const page = fixture.componentInstance;
    page.ordered(true);
    page.addItem();
    page.listItem(0, grammarInlines);
    page.listItem(1, grammarInlines);
    fixture.detectChanges();
    expect(page.block()).toMatchObject({ ordered: true, items: [grammarInlines, grammarInlines] });
    page.removeItem(0);
    page.removeItem(0);
    fixture.detectChanges();
    expect(page.block()).toMatchObject({ items: [grammarInlines] });
    for (let i = 0; i < 110; i++) page.addItem();
    expect(page.block().type === 'list' && page.block()).toMatchObject({
      items: expect.any(Array),
    });
    const block = page.block();
    if (block.type === 'list') expect(block.items).toHaveLength(100);
  });
  it('keeps table headers and rows rectangular across cell/row/column edits', () => {
    const fixture = setup(createGrammarBlock('table', 't'));
    const page = fixture.componentInstance;
    page.headers(true);
    page.addColumn();
    page.addRow();
    page.updateCell(null, 1, grammarInlines);
    page.updateCell(1, 1, grammarInlines);
    fixture.detectChanges();
    let block = page.block();
    if (block.type !== 'table') throw new Error('Expected table');
    expect(block.headers).toHaveLength(2);
    expect(block.rows).toHaveLength(2);
    expect(block.rows[1][1]).toEqual(grammarInlines);
    page.removeColumn(0);
    page.removeRow(0);
    fixture.detectChanges();
    expect(isGrammarDocument({ blocks: [page.block()] })).toBe(true);
    page.removeColumn(0);
    page.removeRow(0);
    block = page.block();
    if (block.type !== 'table') throw new Error('Expected table');
    expect(block.rows).toHaveLength(1);
    expect(block.rows[0]).toHaveLength(1);
    for (let i = 0; i < 25; i++) page.addColumn();
    for (let i = 0; i < 105; i++) page.addRow();
    block = page.block();
    if (block.type !== 'table') throw new Error('Expected table');
    expect(block.headers).toHaveLength(20);
    expect(block.rows).toHaveLength(100);
    page.headers(false);
    expect(page.block()).toMatchObject({ headers: [] });
  });
});
describe('Grammar preview', () => {
  it('renders all blocks, Japanese/Vietnamese, semantic lists/tables and the three marks', () => {
    const fixture = TestBed.createComponent(GrammarPreview);
    fixture.componentRef.setInput('document', grammarDocumentFixture());
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    for (const selector of [
      'h2',
      'p',
      'ol li',
      'table thead th',
      'table tbody td',
      'figure [lang="ja"]',
      'figcaption [lang="vi"]',
      'aside',
      'blockquote',
      'hr',
    ])
      expect(element.querySelector(selector)).not.toBeNull();
    expect(element.querySelector('.font-bold.italic.underline')?.textContent).toContain('𠮷');
    expect(element.textContent).toContain('Tôi là học sinh.');
  });
  it('escapes HTML as text even when an invalid draft reaches preview', () => {
    const fixture = TestBed.createComponent(GrammarPreview);
    const attack = '<img src=x onerror=alert(1)><script>alert(1)</script>';
    fixture.componentRef.setInput('document', {
      blocks: [{ id: 'p', type: 'paragraph', inlines: [{ text: attack, marks: [] }] }],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(attack);
    expect(fixture.nativeElement.querySelector('img, script, [contenteditable]')).toBeNull();
  });
});
