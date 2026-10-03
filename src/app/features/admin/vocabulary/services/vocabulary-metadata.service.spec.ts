import { Observable } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { VocabularyService } from './vocabulary.service';
import { vocabularyMeta as meta } from '../testing/vocabulary-detail.fixture';

describe('Vocabulary metadata result validation', () => {
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

  const cases = [
    {
      path: 'pitch-accents',
      key: 'pitchAccentId',
      add: (service: VocabularyService) =>
        service.addPitchAccents(73, [{ readingId: 887, accentPattern: 4 }]),
      update: (service: VocabularyService) =>
        service.updatePitchAccent(73, 963, { readingId: 887, accentPattern: 4 }),
    },
    {
      path: 'levels',
      key: 'levelId',
      add: (service: VocabularyService) =>
        service.addLevels(73, [{ level: 'N4', displayOrder: 37 }]),
      update: (service: VocabularyService) => service.updateLevel(73, 963, { displayOrder: 37 }),
    },
    {
      path: 'lessons',
      key: 'lessonId',
      add: (service: VocabularyService) =>
        service.addLessons(73, [{ lessonId: 963, displayOrder: 63 }]),
      update: (service: VocabularyService) => service.updateLesson(73, 963, { displayOrder: 63 }),
    },
  ];

  for (const config of cases) {
    it(config.path + ' rejects a mismatched update result identity', () => {
      const error = vi.fn();
      const mutation: Observable<unknown> = config.update(service);

      mutation.subscribe({ error });
      http
        .expectOne('/api/v1/admin/vocabularies/73/' + config.path + '/963')
        .flush({ success: true, data: { [config.key]: 964 }, meta });
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_RESPONSE', meta }),
      );
    });

    for (const data of [
      [],
      [{}],
      [{ [config.key]: 0 }],
      [{ [config.key]: '963' }],
      [{ [config.key]: 963 }, { [config.key]: 964 }],
    ]) {
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

  it('rejects duplicate result identities for an atomic batch', () => {
    const error = vi.fn();

    service.addPartsOfSpeech(73, [{ code: 'NOUN' }, { code: 'VERB' }]).subscribe({ error });

    const post = http.expectOne('/api/v1/admin/vocabularies/73/parts-of-speech');

    expect(post.request.body).toEqual([{ code: 'NOUN' }, { code: 'VERB' }]);
    post.flush({ success: true, data: [{ partOfSpeechId: 44 }, { partOfSpeechId: 44 }], meta });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE' }));
  });
});
