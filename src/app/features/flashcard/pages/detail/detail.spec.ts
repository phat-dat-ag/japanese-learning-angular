import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
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

  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({ flashcardId: '1' }));
    await TestBed.configureTestingModule({
      imports: [FlashcardDetail],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
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
      'Pitch accents: 0',
      'company',
      'công ty',
      'Noun',
      'Danh từ',
      'JLPT N5',
      '6 strokes',
      'カイ',
      'KUN',
      '会社へ行きます。',
      'Tôi đi đến công ty.',
      'Bài 1 tiếng Nhật',
    ]) {
      expect(element.textContent).toContain(text);
    }
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/flashcards');
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
    for (const text of ['No readings', 'No meanings', 'No kanji', 'No examples', 'No lessons'])
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
});
