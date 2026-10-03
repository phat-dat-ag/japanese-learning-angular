import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { VocabularyDetail } from './vocabulary-detail';
import {
  vocabularyDetailFixture,
  vocabularyMeta as meta,
} from '../testing/vocabulary-detail.fixture';
import { isFlashcard } from '../../../flashcard/models/flashcard.model';

const detail = {
  ...vocabularyDetailFixture(73),
  readings: [
    {
      readingId: 415,
      reading: 'first reading',
      isPrimary: true,
      displayOrder: 17,
      pitchAccents: [99],
      pitchAccentDetails: [{ pitchAccentId: 827, accentPattern: 2 }],
    },
    {
      readingId: 887,
      reading: 'second reading',
      isPrimary: true,
      displayOrder: 43,
      pitchAccents: [98],
      pitchAccentDetails: [{ pitchAccentId: 963, accentPattern: 4 }],
    },
  ],
  levels: [
    { levelId: 51, code: 'N5', name: 'JLPT N5', displayOrder: 19 },
    { levelId: 84, code: 'N4', name: 'JLPT N4', displayOrder: 37 },
  ],
  lessons: [
    {
      lessonId: 761,
      levelCode: 'N5',
      levelName: 'JLPT N5',
      lessonNumber: 2,
      title: 'First lesson',
      description: '',
      displayOrder: 3,
      assignmentDisplayOrder: 47,
    },
    {
      lessonId: 982,
      levelCode: 'N4',
      levelName: 'JLPT N4',
      lessonNumber: 6,
      title: 'Second lesson',
      description: '',
      displayOrder: 7,
      assignmentDisplayOrder: 63,
    },
  ],
  partsOfSpeech: [{ code: 'NOUN', nameEn: 'Noun', nameVi: 'Danh từ' }],
};

const configurations = [
  {
    kind: 'pitch-accents',
    id: 963,
    result: { pitchAccentId: 963 },
    input: '#accent-pattern',
    persisted: 4,
    request: { readingId: 887, accentPattern: 4 },
  },
  {
    kind: 'levels',
    id: 84,
    result: { levelId: 84 },
    input: '#level-assignment-order',
    persisted: 37,
    request: { displayOrder: 37 },
  },
  {
    kind: 'lessons',
    id: 982,
    result: { lessonId: 982 },
    input: '#lesson-assignment-order',
    persisted: 63,
    request: { displayOrder: 63 },
  },
] as const;

describe('Vocabulary learning metadata', () => {
  let fixture: ComponentFixture<VocabularyDetail>;
  let http: HttpTestingController;
  let element: HTMLElement;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const getUrl = '/api/v1/flashcards/73';

  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ vocabularyId: '73' }));
    TestBed.configureTestingModule({
      imports: [VocabularyDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(VocabularyDetail);
    element = fixture.nativeElement;
    fixture.detectChanges();
    http.expectOne(getUrl).flush({ success: true, data: detail, meta });
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function section(kind: string): HTMLElement {
    return element
      .querySelector('#' + kind + '-heading')!
      .closest('app-vocabulary-metadata-section')!;
  }

  function button(kind: string, text: string): HTMLButtonElement {
    const found = Array.from(section(kind).querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === text,
    );

    expect(found).toBeDefined();
    return found!;
  }

  async function edit(kind: string, id: number): Promise<void> {
    section(kind)
      .querySelector<HTMLButtonElement>('[data-edit-id="' + id + '"]')!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function set(kind: string, selector: string, value: string): Promise<void> {
    const input = section(kind).querySelector<HTMLInputElement>(selector)!;

    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    await fixture.whenStable();
  }

  async function select(kind: string, selector: string, label: string): Promise<void> {
    const select = section(kind).querySelector<HTMLSelectElement>(selector)!;
    const option = Array.from(select.options).find((option) =>
      option.textContent?.includes(label),
    )!;

    expect(option).toBeDefined();
    select.value = option.value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    await fixture.whenStable();
  }

  function saveLabel(kind: string): string {
    switch (kind) {
      case 'pitch-accents':
        return 'Save pitch accent';
      case 'levels':
        return 'Save level assignment';
      case 'lessons':
        return 'Save lesson assignment';
      default:
        return 'Save part of speech';
    }
  }

  function save(kind: string): void {
    button(kind, saveLabel(kind)).click();
    fixture.detectChanges();
  }

  function fail(request: ReturnType<HttpTestingController['expectOne']>, status = 409): void {
    request.flush(
      {
        success: false,
        error: { code: 'REJECTED', message: 'SQL internal diagnostic', details: [] },
        meta,
      },
      { status, statusText: 'Failure' },
    );
  }

  function refreshed(): void {
    http.expectOne(getUrl).flush({ success: true, data: detail, meta });
    fixture.detectChanges();
  }

  for (const config of configurations) {
    const { kind, id, result, input, persisted, request } = config;
    const url = '/api/v1/admin/vocabularies/73/' + kind + '/' + id;

    it(
      kind + ' initializes exact identities and persisted values; Cancel makes no mutation',
      async () => {
        expect(section(kind).querySelectorAll('[data-edit-id]')).toHaveLength(2);
        await edit(kind, id);
        expect(section(kind).querySelector<HTMLInputElement>(input)!.value).toBe(String(persisted));
        if (kind === 'pitch-accents') {
          const select = section(kind).querySelector<HTMLSelectElement>('#accent-reading')!;

          expect(select.selectedOptions[0].textContent).toContain('second reading');
          expect(section(kind).textContent).not.toContain('Pattern 98');
        }

        await set(kind, input, '25');

        button(kind, 'Cancel').click();
        fixture.detectChanges();
        http.expectNone((req) => req.method !== 'GET');
        expect(section(kind).querySelector('form')).toBeNull();

        await edit(kind, id);

        expect(section(kind).querySelector<HTMLInputElement>(input)!.value).toBe(String(persisted));
      },
    );
    it(
      kind + ' PUT uses the backend ID and exact object, locks duplicate saves, and refetches',
      async () => {
        await edit(kind, id);
        save(kind);
        save(kind);

        const put = http.expectOne(url);

        expect(put.request.method).toBe('PUT');
        expect(put.request.body).toEqual(request);
        expect(Array.isArray(put.request.body)).toBe(false);
        expect(button(kind, saveLabel(kind)).disabled).toBe(true);
        put.flush({ success: true, data: result, meta });

        const next = {
          ...detail,
          levels: detail.levels.map((item) => ({ ...item, displayOrder: 88 })),
          lessons: detail.lessons.map((item) => ({ ...item, assignmentDisplayOrder: 89 })),
          readings: detail.readings.map((item) => ({
            ...item,
            pitchAccentDetails: item.pitchAccentDetails.map((accent) => ({
              ...accent,
              accentPattern: 8,
            })),
          })),
        };

        http.expectOne(getUrl).flush({ success: true, data: next, meta });
        fixture.detectChanges();

        expect(section(kind).querySelector('form')).toBeNull();
        expect(section(kind).textContent).toContain('updated.');
        expect(section(kind).textContent).toContain(
          kind === 'pitch-accents'
            ? 'Pattern 8'
            : kind === 'levels'
              ? 'Assignment order 88'
              : 'Assignment order 89',
        );
      },
    );

    for (const value of ['', '-1', '1.5', '2147483648']) {
      it(kind + ' blocks invalid value ' + JSON.stringify(value), async () => {
        await edit(kind, id);
        await set(kind, input, value);
        save(kind);
        http.expectNone(url);
        expect(button(kind, saveLabel(kind)).disabled).toBe(true);
      });
    }

    it(kind + ' preserves draft and other sections on mutation failure', async () => {
      await edit(kind, id);
      await set(kind, input, '29');
      save(kind);

      fail(http.expectOne(url));
      fixture.detectChanges();
      expect(section(kind).querySelector<HTMLInputElement>(input)!.value).toBe('29');
      expect(section(kind).textContent).toContain('already exists');
      expect(element.textContent).not.toContain('SQL');
      expect(element.textContent).toContain('Core Information');
      expect(element.textContent).toContain('first reading');
      expect(element.textContent).toContain('Noun');

      http.expectNone(getUrl);
      expect(button(kind, saveLabel(kind)).disabled).toBe(false);
    });

    it(
      kind + ' distinguishes committed PUT from refresh failure and retries only GET',
      async () => {
        await edit(kind, id);
        save(kind);

        http.expectOne(url).flush({ success: true, data: result, meta });
        fail(http.expectOne(getUrl), 503);
        fixture.detectChanges();
        expect(section(kind).textContent).toContain('update was saved');
        expect(button(kind, saveLabel(kind)).disabled).toBe(true);

        button(kind, 'Refresh saved details').click();

        fixture.detectChanges();
        http.expectNone(url);
        refreshed();
        expect(section(kind).querySelector('form')).toBeNull();
      },
    );

    it(kind + ' cancels pending requests when the route changes', async () => {
      await edit(kind, id);
      save(kind);

      const pending = http.expectOne(url);

      params.next(convertToParamMap({ vocabularyId: '91' }));
      fixture.detectChanges();
      expect(pending.cancelled).toBe(true);
      http
        .expectOne('/api/v1/flashcards/91')
        .flush({ success: true, data: vocabularyDetailFixture(91), meta });
      fixture.detectChanges();
      expect(section(kind).querySelector('form')).toBeNull();
    });
  }

  it('pitch accent can move to an explicitly selected reading ID', async () => {
    await edit('pitch-accents', 963);
    await select('pitch-accents', '#accent-reading', 'first reading');
    save('pitch-accents');

    const request = http.expectOne('/api/v1/admin/vocabularies/73/pitch-accents/963');

    expect(request.request.body).toEqual({ readingId: 415, accentPattern: 4 });
    request.flush({ success: true, data: { pitchAccentId: 963 }, meta });

    refreshed();
  });

  it('pitch accent and lesson enforce their endpoint-specific bounds', async () => {
    await edit('pitch-accents', 963);
    await set('pitch-accents', '#accent-pattern', '65536');
    save('pitch-accents');

    http.expectNone((req) => req.method === 'PUT');
    button('pitch-accents', 'Cancel').click();
    fixture.detectChanges();

    await edit('lessons', 982);
    await set('lessons', '#lesson-assignment-order', '0');

    save('lessons');
    http.expectNone((req) => req.method === 'PUT');
  });

  it('level order zero is valid', async () => {
    await edit('levels', 84);
    await set('levels', '#level-assignment-order', '0');

    save('levels');

    const request = http.expectOne('/api/v1/admin/vocabularies/73/levels/84');

    expect(request.request.body).toEqual({ displayOrder: 0 });
    request.flush({ success: true, data: { levelId: 84 }, meta });

    refreshed();
  });

  it('keeps independent section refreshes from replacing newer section state', async () => {
    await edit('levels', 84);
    save('levels');

    http
      .expectOne('/api/v1/admin/vocabularies/73/levels/84')
      .flush({ success: true, data: { levelId: 84 }, meta });

    const oldRefresh = http.expectOne(getUrl);

    await edit('lessons', 982);
    save('lessons');

    http
      .expectOne('/api/v1/admin/vocabularies/73/lessons/982')
      .flush({ success: true, data: { lessonId: 982 }, meta });
    http.expectOne(getUrl).flush({
      success: true,
      data: {
        ...detail,
        lessons: detail.lessons.map((item) => ({ ...item, assignmentDisplayOrder: 99 })),
      },
      meta,
    });

    fixture.detectChanges();
    oldRefresh.flush({ success: true, data: detail, meta });
    fixture.detectChanges();
    expect(section('lessons').textContent).toContain('Assignment order 99');
  });

  it('pitch refresh does not overwrite newer reading text', async () => {
    await edit('pitch-accents', 963);
    save('pitch-accents');

    http
      .expectOne('/api/v1/admin/vocabularies/73/pitch-accents/963')
      .flush({ success: true, data: { pitchAccentId: 963 }, meta });

    const old = http.expectOne(getUrl);
    const state = fixture.componentInstance.state();

    if (state.status !== 'loaded') throw new Error('Not loaded');
    fixture.componentInstance.updateReadings(
      state.core.readings.map((item) => ({ ...item, reading: 'new reading text' })),
    );

    fixture.detectChanges();
    old.flush({ success: true, data: detail, meta });
    fixture.detectChanges();

    expect(element.querySelector('app-vocabulary-readings')!.textContent).toContain(
      'new reading text',
    );
    expect(section('pitch-accents').textContent).toContain('new reading text');
  });

  for (const kind of ['pitch-accents', 'levels', 'lessons', 'parts-of-speech']) {
    it(kind + ' Add sends an array and refreshes; POS has no Edit', async () => {
      if (kind === 'parts-of-speech')
        expect(section(kind).querySelector('[data-edit-id]')).toBeNull();

      section(kind).querySelector<HTMLButtonElement>('button')!.click();
      fixture.detectChanges();

      await fixture.whenStable();

      let body: unknown;
      let result: unknown;

      if (kind === 'pitch-accents') {
        await select(kind, '#accent-reading', 'second reading');
        await set(kind, '#accent-pattern', '0');

        body = { readingId: 887, accentPattern: 0 };
        result = { pitchAccentId: 1123 };
      } else if (kind === 'levels') {
        http
          .expectOne('/api/v1/jlpt-levels')
          .flush({ success: true, data: [{ code: 'N3', name: 'JLPT N3' }], meta });
        fixture.detectChanges();

        await select(kind, '#assignment-level', 'JLPT N3');
        await set(kind, '#level-assignment-order', '0');

        body = { level: 'N3', displayOrder: 0 };
        result = { levelId: 99 };
      } else if (kind === 'lessons') {
        expect(section(kind).textContent).toContain('Assign the lesson');
        await select(kind, '#lesson-level', 'JLPT N4');

        http.expectOne('/api/v1/lessons?level=n4').flush({
          success: true,
          data: [{ id: 1563, lessonNumber: 8, title: 'Available lesson', description: '' }],
          meta,
        });

        fixture.detectChanges();

        await select(kind, '#assignment-lesson', 'Available lesson');
        await set(kind, '#lesson-assignment-order', '72');

        body = { lessonId: 1563, displayOrder: 72 };
        result = { lessonId: 1563 };
      } else {
        await set(kind, '#part-of-speech-code', 'VERB');

        body = { code: 'VERB' };
        result = { partOfSpeechId: 44 };
      }

      save(kind);
      save(kind);


      const post = http.expectOne('/api/v1/admin/vocabularies/73/' + kind);
      expect(post.request.method).toBe('POST');
      expect(post.request.body).toEqual([body]);
      post.flush({ success: true, data: [result], meta });

      refreshed();
      expect(section(kind).textContent).toContain('added.');
      expect(section(kind).querySelector('form')).toBeNull();
    });
  }

  it('POS add failure preserves the draft, and committed POST refresh failure retries only GET', async () => {
    const kind = 'parts-of-speech';

    section(kind).querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();

    await fixture.whenStable();
    await set(kind, '#part-of-speech-code', 'VERB');

    save(kind);
    fail(http.expectOne('/api/v1/admin/vocabularies/73/parts-of-speech'), 404);
    fixture.detectChanges();

    expect(section(kind).querySelector<HTMLInputElement>('#part-of-speech-code')!.value).toBe(
      'VERB',
    );
    expect(element.textContent).toContain('Core Information');

    http.expectNone(getUrl);
    save(kind);
    http
      .expectOne('/api/v1/admin/vocabularies/73/parts-of-speech')
      .flush({ success: true, data: [{ partOfSpeechId: 44 }], meta });
    fail(http.expectOne(getUrl), 503);
    fixture.detectChanges();
    expect(section(kind).textContent).toContain('addition was saved');

    button(kind, 'Refresh saved details').click();
    fixture.detectChanges();
    http.expectNone((req) => req.method === 'POST');

    refreshed();
  });

  it('maps structured field errors to safe associated feedback', async () => {
    await edit('pitch-accents', 963);

    save('pitch-accents');
    http.expectOne('/api/v1/admin/vocabularies/73/pitch-accents/963').flush(
      {
        success: false,
        error: {
          code: 'INVALID',
          message: 'SQL',
          details: [{ field: 'accentPattern', message: 'SQL internal' }],
        },
        meta,
      },
      { status: 400, statusText: 'Bad Request' },
    );

    fixture.detectChanges();
    expect(section('pitch-accents').querySelector('#accent-pattern-error')!.textContent).toContain(
      'The server rejected this value',
    );

    expect(section('pitch-accents').textContent).not.toContain('SQL');
  });

  it('lesson choice requests cancel on level changes and Cancel', async () => {
    section('lessons').querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();

    await fixture.whenStable();
    await select('lessons', '#lesson-level', 'JLPT N5');

    const first = http.expectOne('/api/v1/lessons?level=n5');

    await select('lessons', '#lesson-level', 'JLPT N4');

    expect(first.cancelled).toBe(true);

    const second = http.expectOne('/api/v1/lessons?level=n4');

    button('lessons', 'Cancel').click();
    fixture.detectChanges();
    expect(second.cancelled).toBe(true);
    http.expectNone((req) => req.method !== 'GET');
  });

  it('level master data failure can be retried', async () => {
    section('levels').querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    fail(http.expectOne('/api/v1/jlpt-levels'), 503);
    fixture.detectChanges();
    expect(section('levels').textContent).toContain('Unable to load choices');

    button('levels', 'Retry choices').click();
    http
      .expectOne('/api/v1/jlpt-levels')
      .flush({ success: true, data: [{ code: 'N2', name: 'JLPT N2' }], meta });
    fixture.detectChanges();

    expect(section('levels').textContent).toContain('JLPT N2');
  });

  it('POS rejects blank and oversized codes without inventing master data', async () => {
    section('parts-of-speech').querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();

    await fixture.whenStable();

    for (const value of ['   ', 'x'.repeat(51)]) {
      await set('parts-of-speech', '#part-of-speech-code', value);
      save('parts-of-speech');
      http.expectNone((req) => req.method !== 'GET');
    }
  });

  for (const status of [400, 401, 403, 404, 409, 500]) {
    it('safely presents metadata mutation HTTP ' + status, async () => {
      await edit('levels', 84);

      save('levels');
      fail(http.expectOne('/api/v1/admin/vocabularies/73/levels/84'), status);

      fixture.detectChanges();
      expect(section('levels').querySelector('[role="alert"]')).not.toBeNull();
      expect(section('levels').textContent).not.toContain('SQL');
      expect(section('levels').querySelector('form')).not.toBeNull();
    });
  }
});

describe('Metadata read contract validation', () => {
  it('accepts actual stable IDs and independent lesson assignment order', () =>
    expect(isFlashcard(detail)).toBe(true));

  it.each([
    { ...detail, levels: [{ ...detail.levels[0], levelId: undefined }] },
    { ...detail, levels: [detail.levels[0], detail.levels[0]] },
    { ...detail, lessons: [{ ...detail.lessons[0], assignmentDisplayOrder: undefined }] },
    { ...detail, lessons: [{ ...detail.lessons[0], assignmentDisplayOrder: 0 }] },
    { ...detail, lessons: [{ ...detail.lessons[0], lessonId: 0 }] },
    { ...detail, readings: [{ ...detail.readings[0], pitchAccentDetails: undefined }] },
    {
      ...detail,
      readings: [
        { ...detail.readings[0], pitchAccentDetails: [{ pitchAccentId: 0, accentPattern: 2 }] },
      ],
    },
    {
      ...detail,
      readings: [
        {
          ...detail.readings[0],
          pitchAccentDetails: [{ pitchAccentId: 827, accentPattern: 65536 }],
        },
      ],
    },
  ])('rejects identity-incomplete or invalid persisted metadata %#', (value) =>
    expect(isFlashcard(value)).toBe(false),
  );
});
