import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { VocabularyService } from './vocabulary.service';
import { contentDetail } from '../testing/vocabulary-content.fixture';
import { vocabularyMeta as meta } from '../testing/vocabulary-detail.fixture';

describe('Vocabulary content API boundary', () => {
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

  const example = contentDetail.examples[1];
  const kanji = contentDetail.kanji[1];
  const reading = kanji.readings[1];
  const cases = [
    {
      path: 'examples',
      id: example.exampleId,
      key: 'exampleId',
      body: {
        japaneseText: example.japaneseText,
        japaneseReading: example.japaneseReading,
        meaningVi: example.meaningVi,
        meaningEn: example.meaningEn,
        targetText: example.targetText,
        displayOrder: example.displayOrder,
      },
      add: (service: VocabularyService) => service.addExamples(73, [example]),
      update: (service: VocabularyService) => service.updateExample(73, example.exampleId, example),
    },
    {
      path: 'kanji',
      id: kanji.kanjiId,
      key: 'kanjiId',
      body: {
        character: kanji.character,
        strokeCount: kanji.strokeCount,
        meaningVi: kanji.meaningVi,
        meaningEn: kanji.meaningEn,
        displayOrder: kanji.displayOrder,
      },
      add: (service: VocabularyService) => service.addKanji(73, [kanji]),
      update: (service: VocabularyService) => service.updateKanji(73, kanji.kanjiId, kanji),
    },
    {
      path: 'kanji/963/readings',
      id: reading.kanjiReadingId,
      key: 'kanjiReadingId',
      body: {
        reading: reading.reading,
        readingType: reading.readingType,
        displayOrder: reading.displayOrder,
      },
      add: (service: VocabularyService) => service.addKanjiReadings(73, kanji.kanjiId, [reading]),
      update: (service: VocabularyService) =>
        service.updateKanjiReading(73, kanji.kanjiId, reading.kanjiReadingId, reading),
    },
  ];

  for (const config of cases) {
    it(config.path + ' strips read-only IDs and nested data from POST and PUT', () => {
      const added = vi.fn();
      const saved = vi.fn();
      const add: Observable<unknown> = config.add(service);

      add.subscribe(added);

      const post = http.expectOne('/api/v1/admin/vocabularies/73/' + config.path);

      expect(post.request.method).toBe('POST');
      expect(post.request.body).toEqual([config.body]);

      const result = { [config.key]: config.id };

      post.flush({ success: true, data: [result], meta });
      expect(added).toHaveBeenCalledWith({ success: true, data: [result], meta });

      const update: Observable<unknown> = config.update(service);

      update.subscribe(saved);

      const put = http.expectOne('/api/v1/admin/vocabularies/73/' + config.path + '/' + config.id);

      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual(config.body);
      put.flush({ success: true, data: result, meta });
      expect(saved).toHaveBeenCalledWith({ success: true, data: result, meta });
    });

    it(config.path + ' rejects a mismatched update identity', () => {
      const error = vi.fn();
      const mutation: Observable<unknown> = config.update(service);

      mutation.subscribe({ error });
      http
        .expectOne('/api/v1/admin/vocabularies/73/' + config.path + '/' + config.id)
        .flush({ success: true, data: { [config.key]: config.id + 1 }, meta });
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_RESPONSE', meta }),
      );
    });

    for (const data of [[], [{}], [{ [config.key]: 0 }], [{ [config.key]: String(config.id) }]]) {
      it(config.path + ' rejects malformed add results ' + JSON.stringify(data), () => {
        const error = vi.fn();
        const mutation: Observable<unknown> = config.add(service);

        mutation.subscribe({ error });
        http
          .expectOne('/api/v1/admin/vocabularies/73/' + config.path)
          .flush({ success: true, data, meta });
        expect(error).toHaveBeenCalledWith(
          expect.objectContaining({ code: 'INVALID_RESPONSE', meta }),
        );
      });
    }
  }
  it('preserves identities, nullable values and assignment orders in the Admin read boundary', () => {
    const next = vi.fn();

    service.getVocabularyDetail(73).subscribe(next);
    http.expectOne('/api/v1/flashcards/73').flush({ success: true, data: contentDetail, meta });

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          examples: contentDetail.examples,
          kanji: contentDetail.kanji,
        }),
        meta,
      }),
    );
  });
});
