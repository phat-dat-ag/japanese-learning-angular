import { TestBed } from '@angular/core/testing';
import { Flashcard } from './flashcard';
import { Flashcard as FlashcardModel } from '../../models/flashcard.model';

describe('Shared viewing and learning flashcard', () => {
  const firstExample = {
    exampleId: 2,
    displayOrder: 2,
    targetText: '学校',
    japaneseText: '学校へ行きます。',
    japaneseReading: 'がっこうへいきます。',
    meaningVi: 'Tôi đi đến trường.',
    meaningEn: 'I go to school.',
  };
  const card: FlashcardModel = {
    vocabulary: { id: 7, word: '学校', normalizedWord: '学校' },
    readings: [],
    meanings: [],
    partsOfSpeech: [],
    levels: [],
    lessons: [],
    kanji: [],
    examples: [
      firstExample,
      { ...firstExample, exampleId: 1, japaneseText: 'Another example' },
    ],
  };

  it('keeps the first API example through flips and emits the reveal state for rating', async () => {
    await TestBed.configureTestingModule({ imports: [Flashcard] }).compileComponents();
    const fixture = TestBed.createComponent(Flashcard);
    fixture.componentRef.setInput('card', card);
    const revealed = vi.fn();
    fixture.componentInstance.flippedChange.subscribe(revealed);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const front = element.querySelector('.card-front')!;
    const back = element.querySelector('.card-back')!;

    expect(front.querySelectorAll('.example-panel li')).toHaveLength(1);
    expect(front.textContent).toContain(firstExample.japaneseText);
    expect(front.textContent).not.toContain(firstExample.japaneseReading);
    expect(front.textContent).not.toContain(firstExample.meaningVi);
    expect(element.textContent).not.toContain('Another example');

    element.querySelector<HTMLButtonElement>('.flip-control')!.click();
    fixture.detectChanges();

    expect(revealed).toHaveBeenLastCalledWith(true);
    expect(back.getAttribute('aria-hidden')).toBe('false');
    const example = back.querySelector('.example-readings li')!;
    expect(example.querySelector('span[lang="ja"]')?.textContent).toContain(
      firstExample.japaneseReading,
    );
    expect(example.querySelector('span')?.nextElementSibling?.textContent).toContain(
      firstExample.meaningVi,
    );

    element.querySelector<HTMLButtonElement>('.flip-control')!.click();
    fixture.detectChanges();

    expect(revealed).toHaveBeenLastCalledWith(false);
    expect(front.textContent).toContain(firstExample.japaneseText);
  });
});
