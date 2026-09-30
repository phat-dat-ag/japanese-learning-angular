import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../core/api/api-error';
import { vocabularyDetailFixture } from '../testing/vocabulary-detail.fixture';
import { VocabularyService } from './vocabulary.service';

const meta = { timestamp: '2026-09-29', traceId: 'trace', correlationId: 'correlation' };
const data = {
  flashcardItems: [{ id: 42, word: '日本語' }],
  page: 2,
  size: 50,
  totalPages: 3,
  totalElements: 101,
};

describe('VocabularyService read adapter', () => {
  let service: VocabularyService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VocabularyService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('maps list items, preserves pagination and metadata, and normalizes query parameters', () => {
    const next = vi.fn();
    service.getVocabularyList({ level: 'n5', lesson: 7, page: 2, size: 50 }).subscribe(next);
    const request = http.expectOne('/api/v1/flashcards?lesson=7&level=N5&page=2&size=50');
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data, meta });
    expect(next).toHaveBeenCalledWith({
      success: true,
      data: { items: data.flashcardItems, page: 2, size: 50, totalPages: 3, totalElements: 101 },
      meta,
    });
  });

  it('preserves normalized errors and correlation metadata', () => {
    const error = vi.fn();
    service.getVocabularyList({ page: 0, size: 20 }).subscribe({ error });
    http.expectOne('/api/v1/flashcards?page=0&size=20').flush(
      {
        success: false,
        error: { code: 'UNAVAILABLE', message: 'Diagnostic', details: [] },
        meta,
      },
      { status: 503, statusText: 'Unavailable' },
    );
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ApiError',
        code: 'UNAVAILABLE',
        status: 503,
        meta,
      }),
    );
    expect(error.mock.calls[0][0]).toBeInstanceOf(ApiError);
  });
  it('maps real detail core fields while preserving response metadata', () => {
    const next = vi.fn();
    service.getVocabularyDetail(42).subscribe(next);
    http
      .expectOne('/api/v1/flashcards/42')
      .flush({ success: true, data: vocabularyDetailFixture(), meta });
    expect(next).toHaveBeenCalledWith({
      success: true,
      data: { ...vocabularyDetailFixture().vocabulary, readings: [], meanings: [] },
      meta,
    });
  });

  it('rejects a detail response for the wrong vocabulary', () => {
    const error = vi.fn();
    service.getVocabularyDetail(42).subscribe({ error });
    http
      .expectOne('/api/v1/flashcards/42')
      .flush({ success: true, data: vocabularyDetailFixture(73), meta });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE', meta }));
  });

  it('sends only the exact core request and preserves the result envelope', () => {
    const next = vi.fn();
    service.updateVocabularyCore(42, { word: '日本', normalizedWord: 'にほん' }).subscribe(next);
    const request = http.expectOne('/api/v1/admin/vocabularies/42');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ word: '日本', normalizedWord: 'にほん' });
    request.flush({ success: true, data: { vocabularyId: 42 }, meta });
    expect(next).toHaveBeenCalledWith({ success: true, data: { vocabularyId: 42 }, meta });
  });

  it.each([{}, { vocabularyId: '42' }, { vocabularyId: 0 }, { vocabularyId: 73 }])(
    'rejects malformed or mismatched core result %j',
    (data) => {
      const error = vi.fn();
      service
        .updateVocabularyCore(42, { word: '日本', normalizedWord: 'にほん' })
        .subscribe({ error });
      http.expectOne('/api/v1/admin/vocabularies/42').flush({ success: true, data, meta });
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_RESPONSE', meta }),
      );
    },
  );

  it('preserves identified child values from the validated GET', () => {
    const next = vi.fn();
    const detail = {
      ...vocabularyDetailFixture(),
      readings: [
        {
          readingId: 111,
          displayOrder: 17,
          reading: 'にほんご',
          isPrimary: true,
          pitchAccents: [0],
        },
      ],
      meanings: [
        {
          meaningId: 124,
          displayOrder: 29,
          languageCode: 'en',
          meaning: 'Japanese language',
          isPrimary: false,
        },
      ],
    };
    service.getVocabularyDetail(42).subscribe(next);
    http.expectOne('/api/v1/flashcards/42').flush({ success: true, data: detail, meta });
    expect(next).toHaveBeenCalledWith({
      success: true,
      data: { ...detail.vocabulary, readings: detail.readings, meanings: detail.meanings },
      meta,
    });
  });

  it('posts a readings array and preserves IDs and metadata without caching identities', () => {
    const next = vi.fn();
    const requests = [
      { reading: 'にほんご', isPrimary: true, displayOrder: 0 },
      { reading: 'にっぽんご', isPrimary: false, displayOrder: 2 },
    ];
    service.addReadings(42, requests).subscribe(next);
    const request = http.expectOne('/api/v1/admin/vocabularies/42/readings');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(requests);
    request.flush({ success: true, data: [{ readingId: 10 }, { readingId: 11 }], meta });
    expect(next).toHaveBeenCalledWith({
      success: true,
      data: [{ readingId: 10 }, { readingId: 11 }],
      meta,
    });
  });

  it('posts a meanings array using language rather than languageCode', () => {
    const next = vi.fn();
    const requests = [
      { language: 'vi' as const, meaning: 'Tiếng Nhật', isPrimary: false, displayOrder: 0 },
    ];
    service.addMeanings(42, requests).subscribe(next);
    const request = http.expectOne('/api/v1/admin/vocabularies/42/meanings');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(requests);
    request.flush({ success: true, data: [{ meaningId: 10 }], meta });
    expect(next).toHaveBeenCalledWith({ success: true, data: [{ meaningId: 10 }], meta });
  });

  it.each(
    [
      [],
      [{}],
      [{ readingId: '10' }],
      [{ readingId: 0 }],
      [{ readingId: 10 }, { readingId: 11 }],
    ].map((data) => ({ data })),
  )('rejects malformed or mismatched reading results %j', ({ data }) => {
    const error = vi.fn();
    service
      .addReadings(42, [{ reading: 'a', isPrimary: true, displayOrder: 0 }])
      .subscribe({ error });
    http.expectOne('/api/v1/admin/vocabularies/42/readings').flush({ success: true, data, meta });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE', meta }));
  });

  it.each(
    [
      [],
      [{}],
      [{ meaningId: '10' }],
      [{ meaningId: 0 }],
      [{ meaningId: 10 }, { meaningId: 11 }],
    ].map((data) => ({ data })),
  )('rejects malformed or mismatched meaning results %j', ({ data }) => {
    const error = vi.fn();
    service
      .addMeanings(42, [{ language: 'en', meaning: 'a', isPrimary: false, displayOrder: 0 }])
      .subscribe({ error });
    http.expectOne('/api/v1/admin/vocabularies/42/meanings').flush({ success: true, data, meta });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE', meta }));
  });

  it('PUTs a reading object to its backend identity and preserves the result envelope', () => {
    const next = vi.fn();
    service
      .updateReading(73, 887, { reading: 'にっぽんご', isPrimary: false, displayOrder: 43 })
      .subscribe(next);
    const request = http.expectOne('/api/v1/admin/vocabularies/73/readings/887');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      reading: 'にっぽんご',
      isPrimary: false,
      displayOrder: 43,
    });
    request.flush({ success: true, data: { readingId: 887 }, meta });
    expect(next).toHaveBeenCalledWith({ success: true, data: { readingId: 887 }, meta });
  });

  it('PUTs a meaning object with language instead of languageCode', () => {
    const next = vi.fn();
    service
      .updateMeaning(73, 992, {
        language: 'vi',
        meaning: 'Tiếng Nhật',
        isPrimary: true,
        displayOrder: 61,
      })
      .subscribe(next);
    const request = http.expectOne('/api/v1/admin/vocabularies/73/meanings/992');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      language: 'vi',
      meaning: 'Tiếng Nhật',
      isPrimary: true,
      displayOrder: 61,
    });
    request.flush({ success: true, data: { meaningId: 992 }, meta });
    expect(next).toHaveBeenCalledWith({ success: true, data: { meaningId: 992 }, meta });
  });

  it.each(['reading', 'meaning'] as const)('rejects mismatched %s PUT result identity', (kind) => {
    const error = vi.fn();
    if (kind === 'reading')
      service
        .updateReading(73, 887, { reading: 'a', isPrimary: true, displayOrder: 0 })
        .subscribe({ error });
    else
      service
        .updateMeaning(73, 992, { language: 'en', meaning: 'a', isPrimary: false, displayOrder: 0 })
        .subscribe({ error });
    http
      .expectOne('/api/v1/admin/vocabularies/73/' + kind + 's/' + (kind === 'reading' ? 887 : 992))
      .flush({
        success: true,
        data: kind === 'reading' ? { readingId: 1 } : { meaningId: 1 },
        meta,
      });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE', meta }));
  });

  it.each([
    { readingId: undefined },
    { readingId: 0 },
    { readingId: -1 },
    { readingId: 1.5 },
    { readingId: '887' },
    { displayOrder: undefined },
    { displayOrder: -1 },
    { displayOrder: 1.5 },
    { displayOrder: 2147483648 },
  ])('rejects invalid reading identity/order %j at the read boundary', (patch) => {
    const error = vi.fn();
    service.getVocabularyDetail(73).subscribe({ error });
    http.expectOne('/api/v1/flashcards/73').flush({
      success: true,
      data: {
        ...vocabularyDetailFixture(73),
        readings: [
          {
            readingId: 887,
            reading: 'a',
            isPrimary: true,
            displayOrder: 43,
            pitchAccents: [],
            ...patch,
          },
        ],
      },
      meta,
    });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE' }));
  });

  it.each([
    { meaningId: undefined },
    { meaningId: 0 },
    { meaningId: -1 },
    { meaningId: 1.5 },
    { meaningId: '992' },
    { displayOrder: undefined },
    { displayOrder: -1 },
    { displayOrder: 1.5 },
    { displayOrder: 2147483648 },
  ])('rejects invalid meaning identity/order %j at the read boundary', (patch) => {
    const error = vi.fn();
    service.getVocabularyDetail(73).subscribe({ error });
    http.expectOne('/api/v1/flashcards/73').flush({
      success: true,
      data: {
        ...vocabularyDetailFixture(73),
        meanings: [
          {
            meaningId: 992,
            languageCode: 'vi',
            meaning: 'a',
            isPrimary: true,
            displayOrder: 61,
            ...patch,
          },
        ],
      },
      meta,
    });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE' }));
  });

  it('rejects duplicate child identities rather than exposing ambiguous Edit targets', () => {
    const error = vi.fn();
    const reading = {
      readingId: 887,
      reading: 'a',
      isPrimary: true,
      displayOrder: 43,
      pitchAccents: [],
    };
    service.getVocabularyDetail(73).subscribe({ error });
    http.expectOne('/api/v1/flashcards/73').flush({
      success: true,
      data: { ...vocabularyDetailFixture(73), readings: [reading, reading] },
      meta,
    });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE' }));
  });
});
