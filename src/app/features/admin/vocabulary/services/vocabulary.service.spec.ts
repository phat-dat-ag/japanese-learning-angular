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

  it('preserves identity-incomplete child values from the validated GET', () => {
    const next = vi.fn();
    const detail = {
      ...vocabularyDetailFixture(),
      readings: [{ reading: 'にほんご', isPrimary: true, pitchAccents: [0] }],
      meanings: [{ languageCode: 'en', meaning: 'Japanese language', isPrimary: false }],
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
});
