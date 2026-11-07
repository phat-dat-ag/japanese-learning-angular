import { TestBed } from '@angular/core/testing';
import {
  grammarDocumentFixture,
  grammarInlines,
} from '../../admin/lessons/testing/grammar-content.fixture';
import { GrammarContent } from './grammar-content';

describe('Shared read-only grammar renderer', () => {
  it('renders all blocks and translations without editing controls', () => {
    const fixture = TestBed.createComponent(GrammarContent);
    fixture.componentRef.setInput('document', grammarDocumentFixture());
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    for (const selector of [
      'h2',
      'p',
      'ol li',
      'table th[scope="col"]',
      'table td',
      'figure [lang="ja"]',
      'figcaption [lang="vi"]',
      '[lang="en"]',
      'aside',
      'blockquote',
      'hr',
    ])
      expect(element.querySelector(selector)).not.toBeNull();
    expect(element.querySelector('.font-bold.italic.underline')?.textContent).toContain(
      '日本語 𠮷 — Tiếng Việt',
    );
    expect(element.querySelector('input, textarea, button, [contenteditable]')).toBeNull();
    expect(
      element.querySelector('[role="region"][tabindex="0"]')?.classList.contains('overflow-x-auto'),
    ).toBe(true);
  });
  it('escapes unsafe text and distinguishes all four callout styles', () => {
    const fixture = TestBed.createComponent(GrammarContent);
    fixture.componentRef.setInput('document', {
      blocks: [
        {
          id: 'p',
          type: 'paragraph',
          inlines: [{ text: '<img src=x onerror=alert(1)>', marks: [] }],
        },
        ...(['note', 'tip', 'warning', 'information'] as const).map((variant) => ({
          id: variant,
          type: 'callout',
          variant,
          inlines: grammarInlines,
        })),
      ],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(fixture.nativeElement.querySelector('img, script')).toBeNull();
    for (const [variant, color] of [
      ['note', 'bg-indigo-50'],
      ['tip', 'bg-emerald-50'],
      ['warning', 'bg-amber-50'],
      ['information', 'bg-sky-50'],
    ])
      expect(
        fixture.nativeElement
          .querySelector(`[aria-label="${variant} callout"]`)
          .classList.contains(color),
      ).toBe(true);
  });
  it('supports every heading level and unordered lists', () => {
    const fixture = TestBed.createComponent(GrammarContent);
    fixture.componentRef.setInput('document', {
      blocks: [
        ...[1, 2, 3, 4, 5, 6].map((level) => ({
          id: `h${level}`,
          type: 'heading',
          level,
          inlines: grammarInlines,
        })),
        { id: 'list', type: 'list', ordered: false, items: [grammarInlines] },
      ],
    });
    fixture.detectChanges();
    for (const level of [1, 2, 3, 4, 5, 6])
      expect(fixture.nativeElement.querySelector(`h${level}`)).not.toBeNull();
    expect(fixture.nativeElement.querySelector('ul li')).not.toBeNull();
  });
});
