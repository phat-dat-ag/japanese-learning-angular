import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { FlashcardDetail } from './detail';
import { Flashcard } from '../../models/flashcard.model';

const meta = { timestamp: '2026-09-14T14:52:10Z', traceId: 'trace', correlationId: 'correlation' };
const card: Flashcard = {
  vocabulary: { id: 1, word: '会社', normalizedWord: '会社' },
  readings: [{ reading: 'かいしゃ', isPrimary: true, pitchAccents: [0] }],
  meanings: [
    { languageCode: 'en', meaning: 'company', isPrimary: true },
    { languageCode: 'vi', meaning: 'công ty', isPrimary: true },
  ],
  partsOfSpeech: [{ code: 'NOUN', nameVi: 'Danh từ', nameEn: 'Noun' }],
  levels: [{ code: 'N5', name: 'JLPT N5' }],
  lessons: [
    {
      levelCode: 'N5',
      levelName: 'JLPT N5',
      lessonNumber: 1,
      title: 'Bài 1 tiếng Nhật',
      description: 'Lesson description',
      displayOrder: 1,
    },
  ],
  kanji: [
    {
      character: '会',
      strokeCount: 6,
      meaningVi: 'hội, gặp',
      meaningEn: 'meeting',
      readings: [
        { reading: 'カイ', readingType: 'ON' },
        { reading: 'あ', readingType: 'KUN' },
      ],
    },
  ],
  examples: [
    {
      japaneseText: '会社へ行きます。',
      japaneseReading: 'かいしゃへいきます。',
      meaningVi: 'Tôi đi đến công ty.',
      meaningEn: 'I go to the company.',
      targetText: '会社',
    },
  ],
};

describe('Flashcard detail', () => {
  let fixture: ComponentFixture<FlashcardDetail>;
  let http: HttpTestingController;
  let element: HTMLElement;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(async () => {
    queryParams = new BehaviorSubject(convertToParamMap({}));
    params = new BehaviorSubject(convertToParamMap({ flashcardId: '1' }));
    await TestBed.configureTestingModule({
      imports: [FlashcardDetail],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params, queryParamMap: queryParams } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FlashcardDetail);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('requests the card by ID and renders backend detail sections', () => {
    expect(element.textContent).toContain('Loading flashcard');
    const request = http.expectOne('/api/v1/flashcards/1');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Accept')).toBe('application/json');
    request.flush({ success: true, data: card, meta });
    fixture.detectChanges();
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('会社');
    for (const text of [
      'かいしゃ',
      'company',
      'công ty',
      'Noun',
      'Danh từ',
      'JLPT N5',
      '会社へ行きます。',
      'Bài 1 tiếng Nhật',
    ]) {
      expect(element.textContent).toContain(text);
    }
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/flashcards');
  });

  it('places readings beneath focusable words and removes kanji connections', () => {
    http.expectOne('/api/v1/flashcards/1').flush({ success: true, data: card, meta });
    fixture.detectChanges();
    const words = element.querySelector('.card-front .word-block')!;
    expect(words.querySelector('.vocabulary-readings')?.textContent).toContain('かいしゃ');
    for (const selector of ['.vocabulary-word', '.normalized-word']) {
      const word = words.querySelector<HTMLElement>(selector)!;
      expect(word.tabIndex).toBe(0);
      word.focus();
      expect(document.activeElement).toBe(word);
    }
    expect(element.querySelector('.card-back [aria-label="Readings"]')).toBeNull();
    expect(element.textContent).not.toContain('Kanji connections');
    expect(element.textContent).not.toContain('6 strokes');
    expect(element.querySelectorAll('.example-panel li')).toHaveLength(1);
    expect(element.querySelectorAll('.example-readings li')).toHaveLength(1);
  });
  it('renders empty collections without invented content', () => {
    http.expectOne('/api/v1/flashcards/1').flush({
      success: true,
      data: {
        ...card,
        readings: [],
        meanings: [],
        partsOfSpeech: [],
        levels: [],
        lessons: [],
        kanji: [],
        examples: [],
      },
      meta,
    });
    fixture.detectChanges();
    for (const text of ['No readings', 'No meanings', 'No examples'])
      expect(element.textContent).toContain(text);
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows safe errors and retries', () => {
    http
      .expectOne('/api/v1/flashcards/1')
      .flush('private diagnostic', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(element.textContent).toContain('Unable to load flashcard');
    expect(element.textContent).not.toContain('private diagnostic');
    element.querySelector<HTMLButtonElement>('button')!.click();
    http.expectOne('/api/v1/flashcards/1').flush({ success: true, data: card, meta });
    fixture.detectChanges();
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('会社');
  });

  it('handles a missing flashcard', () => {
    http.expectOne('/api/v1/flashcards/1').flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(element.textContent).toContain('Flashcard not found');
  });

  it.each(['0', '-1', 'abc', '1.5', '1e2', '9007199254740992', ''])(
    'rejects invalid ID %s without a new request',
    (id) => {
      const previous = http.expectOne('/api/v1/flashcards/1');
      params.next(convertToParamMap({ flashcardId: id }));
      expect(previous.cancelled).toBe(true);
      fixture.detectChanges();
      expect(element.textContent).toContain('Flashcard not found');
      http.expectNone(() => true);
    },
  );

  it('cancels stale requests and loads a new route ID', () => {
    const previous = http.expectOne('/api/v1/flashcards/1');
    params.next(convertToParamMap({ flashcardId: '2' }));
    expect(previous.cancelled).toBe(true);
    http.expectOne('/api/v1/flashcards/2').flush({
      success: true,
      data: { ...card, vocabulary: { id: 2, word: '学校', normalizedWord: '学校' } },
      meta,
    });
    fixture.detectChanges();
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('学校');
  });

  it.each([
    { ...card, vocabulary: { id: 1, word: '', normalizedWord: '' } },
    { ...card, readings: [{ reading: 'かいしゃ', isPrimary: true, pitchAccents: ['0'] }] },
    { ...card, meanings: [{ languageCode: 'en', meaning: 42, isPrimary: true }] },
    { ...card, kanji: [{ ...card.kanji[0], readings: null }] },
    { ...card, examples: [{ japaneseText: '会社' }] },
    null,
  ])('rejects malformed payloads', (data) => {
    http.expectOne('/api/v1/flashcards/1').flush({ success: true, data, meta });
    fixture.detectChanges();
    expect(element.textContent).toContain('Unable to load flashcard');
    expect(element.querySelector('app-flashcard')).toBeNull();
  });

  it('flips both ways using a native keyboard-accessible button', () => {
    http.expectOne('/api/v1/flashcards/1').flush({ success: true, data: card, meta });
    fixture.detectChanges();
    const button = element.querySelector<HTMLButtonElement>('.flip-control')!;
    const front = element.querySelector('.card-front')!;
    const back = element.querySelector('.card-back')!;
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(front.getAttribute('aria-hidden')).toBe('false');
    expect(back.hasAttribute('inert')).toBe(true);
    button.focus();
    expect(document.activeElement).toBe(button);
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Show vocabulary');
    expect(front.hasAttribute('inert')).toBe(true);
    expect(back.getAttribute('aria-hidden')).toBe('false');
    expect(back.textContent).toContain('company');
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(front.hasAttribute('inert')).toBe(false);
  });

  it('shows two plain Japanese examples on the front and their readings on the back', () => {
    const example = card.examples[0]!;
    http.expectOne('/api/v1/flashcards/1').flush({
      success: true,
      data: {
        ...card,
        examples: [
          { ...example, japaneseText: '会社と会社', targetText: '会社' },
          { ...example, japaneseText: 'a+b と a+b', targetText: 'a+b' },
          { ...example, japaneseText: 'Third example' },
        ],
      },
      meta,
    });
    fixture.detectChanges();
    const examples = element.querySelector('.example-panel')!;
    expect(examples.querySelectorAll('li')).toHaveLength(2);
    expect(examples.querySelector('mark')).toBeNull();
    expect(examples.textContent).not.toContain('Third example');
    expect(element.textContent).not.toContain(example.meaningEn);
    expect(element.textContent).not.toContain(example.meaningVi);
    expect(element.querySelector('.card-front')?.textContent).not.toContain(
      example.japaneseReading,
    );
    expect(element.querySelector('.example-readings')?.textContent).toContain(
      example.japaneseReading,
    );
    expect(element.querySelectorAll('.example-readings li')).toHaveLength(2);
  });

  it.each(['', 'absent'])('preserves example text when target is %s', (targetText) => {
    http.expectOne('/api/v1/flashcards/1').flush({
      success: true,
      data: {
        ...card,
        examples: [{ ...card.examples[0]!, japaneseText: '会社へ行きます。', targetText }],
      },
      meta,
    });
    fixture.detectChanges();
    expect(element.querySelector('.example-text')?.textContent?.trim()).toBe('会社へ行きます。');
    expect(element.querySelector('mark')).toBeNull();
  });

  it('starts on the front when navigating from a flipped card to another card', () => {
    http.expectOne('/api/v1/flashcards/1').flush({ success: true, data: card, meta });
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.flip-control')!.click();
    fixture.detectChanges();
    params.next(convertToParamMap({ flashcardId: '2' }));
    http.expectOne('/api/v1/flashcards/2').flush({
      success: true,
      data: { ...card, vocabulary: { ...card.vocabulary, id: 2 } },
      meta,
    });
    fixture.detectChanges();
    expect(element.querySelector('.flip-control')?.getAttribute('aria-pressed')).toBe('false');
  });

  it.each([
    { reading: 'かいしゃ', accents: [3], morae: ['か', 'い', 'しゃ'], highlighted: ['しゃ'] },
    { reading: 'がっこう', accents: [2], morae: ['が', 'っ', 'こ', 'う'], highlighted: ['っ'] },
    { reading: 'せんせい', accents: [2], morae: ['せ', 'ん', 'せ', 'い'], highlighted: ['ん'] },
    { reading: 'スーパー', accents: [2], morae: ['ス', 'ー', 'パ', 'ー'], highlighted: ['ー'] },
    { reading: 'かいしゃ', accents: [0], morae: ['か', 'い', 'しゃ'], highlighted: [] },
    { reading: 'あめ', accents: [0, 1, 2], morae: ['あ', 'め'], highlighted: ['あ', 'め'] },
    { reading: 'あめ', accents: [], morae: ['あ', 'め'], highlighted: [] },
    { reading: 'あめ', accents: [9], morae: ['あ', 'め'], highlighted: [] },
  ])(
    'renders API accent variants for $reading with $accents',
    ({ reading, accents, morae, highlighted }) => {
      http.expectOne('/api/v1/flashcards/1').flush({
        success: true,
        data: { ...card, readings: [{ reading, isPrimary: true, pitchAccents: accents }] },
        meta,
      });
      fixture.detectChanges();
      const front = element.querySelector('.card-front')!;
      const back = element.querySelector('.card-back')!;
      expect(back.querySelector('.reading')).toBeNull();
      expect(front.textContent).not.toContain('Pitch accents:');
      expect(
        Array.from(
          front.querySelector('.reading-morae')!.querySelectorAll('.mora'),
          (mora) => mora.textContent,
        ),
      ).toEqual(morae);
      expect(
        Array.from(front.querySelectorAll('.accented-mora'), (mora) => mora.textContent),
      ).toEqual(highlighted);
      expect(front.querySelectorAll('.reading')).toHaveLength(Math.max(1, accents.length));
      expect(back.textContent).not.toContain('No pitch drop');
      expect(back.textContent).not.toContain('Pitch accent unavailable');
      expect(back.textContent).not.toContain('Pitch drops after mora');
    },
  );

  function loadNavigation(ids: readonly number[]): void {
    queryParams.next(convertToParamMap({ lesson: '1', level: 'n5' }));
    http.expectOne('/api/v1/flashcards?lesson=1&level=N5&page=0&size=20').flush({
      success: true,
      data: {
        flashcardItems: ids.map((id) => ({ id, word: 'Word' })),
        page: 0,
        size: 20,
        totalElements: ids.length,
        totalPages: ids.length ? 1 : 0,
      },
      meta,
    });
    http.expectOne('/api/v1/flashcards/1').flush({ success: true, data: card, meta });
    fixture.detectChanges();
  }

  it.each([{ ids: [] }, { ids: [1] }, { ids: [7, 8] }])(
    'hides navigation without at least two cards including the current card: %j',
    ({ ids }) => {
      loadNavigation(ids);
      expect(element.querySelector('nav')).toBeNull();
    },
  );

  it.each([
    { current: 1, direction: 'next', target: 7 },
    { current: 7, direction: 'previous', target: 1 },
    { current: 12, direction: 'next', target: 1 },
    { current: 1, direction: 'previous', target: 12 },
  ] as const)(
    'moves $direction from $current to $target and resets the face',
    async ({ current, direction, target }) => {
      loadNavigation([1, 7, 12]);
      if (current !== 1) {
        params.next(convertToParamMap({ flashcardId: String(current) }));
        http.expectOne('/api/v1/flashcards/' + current).flush({
          success: true,
          data: { ...card, vocabulary: { ...card.vocabulary, id: current } },
          meta,
        });
        fixture.detectChanges();
      }
      element.querySelector<HTMLButtonElement>('.flip-control')!.click();
      fixture.detectChanges();
      const navigate = vi
        .spyOn(TestBed.inject(Router), 'navigate')
        .mockImplementation(async (commands) => {
          params.next(convertToParamMap({ flashcardId: String(commands[2]) }));
          return true;
        });
      const button = element.querySelector<HTMLButtonElement>(
        direction === 'next'
          ? '[aria-label="Next flashcard"]'
          : '[aria-label="Previous flashcard"]',
      )!;
      button.focus();
      button.click();
      fixture.detectChanges();
      expect(button.disabled).toBe(true);
      expect(navigate).toHaveBeenCalledWith(['/flashcards', 'detail', target], {
        queryParamsHandling: 'preserve',
      });
      http.expectOne('/api/v1/flashcards/' + target).flush({
        success: true,
        data: {
          ...card,
          vocabulary: { id: target, word: 'Next word', normalizedWord: 'Next word' },
        },
        meta,
      });
      await fixture.whenStable();
      fixture.detectChanges();
      expect(element.querySelector('h1')?.textContent).toBe('Next word');
      expect(element.querySelector('.flip-control')?.getAttribute('aria-pressed')).toBe('false');
      expect(element.querySelector('.card-stage')?.classList.contains('previous')).toBe(
        direction === 'previous',
      );
      expect(document.activeElement).toBe(button);
      http.expectNone((request) => request.url.includes('lesson='));
    },
  );

  it('loads navigation across all lesson pages in API order', () => {
    queryParams.next(convertToParamMap({ lesson: '1', level: 'n5' }));
    http.expectOne('/api/v1/flashcards?lesson=1&level=N5&page=0&size=20').flush({
      success: true,
      data: {
        flashcardItems: Array.from({ length: 20 }, (_, index) => ({ id: index + 1, word: 'Word' })),
        page: 0,
        size: 20,
        totalElements: 21,
        totalPages: 2,
      },
      meta,
    });
    http.expectOne('/api/v1/flashcards?lesson=1&level=N5&page=1&size=20').flush({
      success: true,
      data: {
        flashcardItems: [{ id: 99, word: 'Last' }],
        page: 1,
        size: 20,
        totalElements: 21,
        totalPages: 2,
      },
      meta,
    });
    http.expectOne('/api/v1/flashcards/1').flush({ success: true, data: card, meta });
    fixture.detectChanges();
    expect(fixture.componentInstance.navigation()).toEqual({
      index: 0,
      total: 21,
      previousId: 99,
      nextId: 2,
    });
  });

  it('shows navigation errors separately and retries the list', () => {
    queryParams.next(convertToParamMap({ lesson: '1', level: 'n5' }));
    http
      .expectOne('/api/v1/flashcards?lesson=1&level=N5&page=0&size=20')
      .flush('private diagnostic', { status: 500, statusText: 'Server Error' });
    http.expectOne('/api/v1/flashcards/1').flush({ success: true, data: card, meta });
    fixture.detectChanges();
    expect(element.querySelector('h1')?.textContent).toBe(card.vocabulary.word);
    expect(element.textContent).toContain('Unable to load flashcard navigation');
    expect(element.textContent).not.toContain('private diagnostic');
    fixture.componentInstance.retryNavigation();
    http.expectOne('/api/v1/flashcards?lesson=1&level=N5&page=0&size=20').flush({
      success: true,
      data: {
        flashcardItems: [
          { id: 1, word: 'First' },
          { id: 2, word: 'Second' },
        ],
        page: 0,
        size: 20,
        totalElements: 2,
        totalPages: 1,
      },
      meta,
    });
    fixture.detectChanges();
    expect(element.querySelector('nav')).not.toBeNull();
  });

  it('handles router failure and permits retry', async () => {
    loadNavigation([1, 2]);
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockRejectedValueOnce(new Error('Navigation failure'));
    await fixture.componentInstance.move('next');
    fixture.detectChanges();
    expect(element.textContent).toContain('Unable to open the flashcard');
    expect(fixture.componentInstance.moving()).toBe(false);
    navigate.mockResolvedValueOnce(true);
    await fixture.componentInstance.move('next');
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.navigationFailed()).toBe(false);
  });

  it('cancels navigation loading when the lesson context changes', () => {
    queryParams.next(convertToParamMap({ lesson: '1', level: 'n5' }));
    const request = http.expectOne('/api/v1/flashcards?lesson=1&level=N5&page=0&size=20');
    queryParams.next(convertToParamMap({ lesson: 'invalid', level: 'n5' }));
    expect(request.cancelled).toBe(true);
    http.expectOne('/api/v1/flashcards/1').flush({ success: true, data: card, meta });
    fixture.detectChanges();
    expect(element.querySelector('nav')).toBeNull();
  });
});
