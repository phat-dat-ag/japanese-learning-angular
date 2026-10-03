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
import { contentDetail as detail } from '../testing/vocabulary-content.fixture';
import { isFlashcard } from '../../../flashcard/models/flashcard.model';

const configurations = [
  {
    kind: 'example',
    selector: 'app-vocabulary-examples',
    id: 845,
    path: 'examples',
    prefix: 'example',
    order: 62,
    field: 'japaneseText',
    max: 1000,
    save: 'Save example',
    add: 'Add example',
    title: 'Example',
    request: {
      japaneseText: 'Second sentence',
      japaneseReading: 'second reading',
      meaningVi: 'second vi',
      meaningEn: 'second en',
      targetText: 'Second',
      displayOrder: 62,
    },
    result: { exampleId: 845 },
  },
  {
    kind: 'kanji',
    selector: 'app-vocabulary-kanji',
    id: 963,
    path: 'kanji',
    prefix: 'kanji',
    order: 81,
    field: 'character',
    max: 10,
    save: 'Save kanji',
    add: 'Add or attach kanji',
    title: 'Kanji',
    request: {
      character: 'B',
      strokeCount: null,
      meaningVi: '',
      meaningEn: null,
      displayOrder: 81,
    },
    result: { kanjiId: 963 },
  },
  {
    kind: 'kanji reading',
    selector: '[data-kanji-id="963"] app-vocabulary-kanji-readings',
    id: 1198,
    path: 'kanji/963/readings',
    prefix: 'kanji-reading-963',
    order: 74,
    field: 'reading',
    max: 100,
    save: 'Save kanji reading',
    add: 'Add kanji reading',
    title: 'Kanji Reading',
    request: { reading: 'second other', readingType: 'CUSTOM', displayOrder: 74 },
    result: { kanjiReadingId: 1198 },
  },
] as const;

describe('Vocabulary Examples, Kanji and nested readings', () => {
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

  function section(selector: string): HTMLElement {
    return element.querySelector(selector)!;
  }

  function button(selector: string, text: string): HTMLButtonElement {
    const found = Array.from(section(selector).querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === text,
    );
    expect(found).toBeDefined();
    return found!;
  }

  async function edit(config: (typeof configurations)[number]): Promise<void> {
    section(config.selector)
      .querySelector<HTMLButtonElement>('[data-edit-id="' + config.id + '"]')!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function set(prefix: string, field: string, value: string): Promise<void> {
    const input = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      '#' + prefix + '-' + field,
    )!;
    expect(input).not.toBeNull();
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function save(config: (typeof configurations)[number]): void {
    button(config.selector, config.save).click();
    fixture.detectChanges();
  }

  function fail(request: ReturnType<HttpTestingController['expectOne']>, status = 409): void {
    request.flush(
      { success: false, error: { code: 'CONFLICT', message: 'SQL diagnostic', details: [] }, meta },
      { status, statusText: 'Failure' },
    );
  }

  function refresh(): void {
    http.expectOne(getUrl).flush({ success: true, data: detail, meta });
    fixture.detectChanges();
  }

  for (const config of configurations) {
    const { selector, id, path, prefix, order, field, max, result, request, kind } = config;
    const url = '/api/v1/admin/vocabularies/73/' + path + '/' + id;

    it(
      kind + ' renders and initializes exact identity/order; Cancel discards without HTTP',
      async () => {
        expect(section(selector).querySelector('[data-edit-id="' + id + '"]')).not.toBeNull();
        await edit(config);

        expect(section(selector).textContent).toContain('Editing ' + config.title);
        expect(element.querySelector<HTMLInputElement>('#' + prefix + '-order')!.value).toBe(
          String(order),
        );

        if (kind === 'kanji') {
          expect(element.querySelector<HTMLInputElement>('#kanji-strokeCount')!.value).toBe('');
          expect(
            element.querySelector<HTMLInputElement>('input[name="meaningViUnset"]')!.checked,
          ).toBe(false);
          expect(
            element.querySelector<HTMLInputElement>('input[name="meaningEnUnset"]')!.checked,
          ).toBe(true);
        }

        await set(prefix, field, 'draft');

        button(selector, 'Cancel').click();
        fixture.detectChanges();
        http.expectNone((req) => req.method !== 'GET');
        expect(section(selector).querySelector('form')).toBeNull();
        await edit(config);
        expect(element.querySelector<HTMLInputElement>('#' + prefix + '-order')!.value).toBe(
          String(order),
        );
      },
    );

    it(
      kind + ' PUT uses exact backend identities and object payload, then authoritative data',
      async () => {
        await edit(config);
        save(config);
        save(config);

        const put = http.expectOne(url);

        expect(put.request.method).toBe('PUT');
        expect(put.request.body).toEqual(request);
        expect(Array.isArray(put.request.body)).toBe(false);
        expect(button(selector, config.save).disabled).toBe(true);
        put.flush({ success: true, data: result, meta });

        const current = {
          ...detail,
          examples: detail.examples.map((item) => ({
            ...item,
            japaneseText: 'Authoritative sentence',
          })),
          kanji: detail.kanji.map((item) => ({
            ...item,
            character: 'C',
            readings: item.readings.map((reading) => ({
              ...reading,
              reading: 'Authoritative reading',
            })),
          })),
        };

        http.expectOne(getUrl).flush({ success: true, data: current, meta });
        fixture.detectChanges();

        expect(section(selector).querySelector('form')).toBeNull();
        expect(section(selector).textContent).toContain('updated.');
        expect(section(selector).textContent).toContain(
          kind === 'example'
            ? 'Authoritative sentence'
            : kind === 'kanji'
              ? 'C'
              : 'Authoritative reading',
        );
      },
    );

    it(kind + ' Add sends one-element array and keeps Cancel free of HTTP', async () => {
      button(selector, config.add).click();
      fixture.detectChanges();

      await fixture.whenStable();
      expect(section(selector).textContent).toContain('Adding ' + config.title);
      button(selector, 'Cancel').click();
      fixture.detectChanges();
      http.expectNone((req) => req.method !== 'GET');
      button(selector, config.add).click();
      fixture.detectChanges();

      await fixture.whenStable();

      let expected: unknown;

      if (kind === 'example') {
        for (const name of [
          'japaneseText',
          'japaneseReading',
          'meaningVi',
          'meaningEn',
          'targetText',
        ])
          await set(prefix, name, 'New ' + name);

        expected = {
          japaneseText: 'New japaneseText',
          japaneseReading: 'New japaneseReading',
          meaningVi: 'New meaningVi',
          meaningEn: 'New meaningEn',
          targetText: 'New targetText',
          displayOrder: 0,
        };
      } else if (kind === 'kanji') {
        await set(prefix, 'character', 'D');

        expected = {
          character: 'D',
          strokeCount: null,
          meaningVi: null,
          meaningEn: null,
          displayOrder: 0,
        };
      } else {
        await set(prefix, 'reading', 'new reading');
        await set(prefix, 'readingType', 'CUSTOM-TYPE');

        expected = { reading: 'new reading', readingType: 'CUSTOM-TYPE', displayOrder: 0 };
      }

      await set(prefix, 'order', '0');
      save(config);
      save(config);

      const post = http.expectOne('/api/v1/admin/vocabularies/73/' + path);

      expect(post.request.method).toBe('POST');
      expect(post.request.body).toEqual([expected]);
      post.flush({ success: true, data: [result], meta });

      refresh();

      expect(section(selector).querySelector('form')).toBeNull();
      expect(section(selector).textContent).toContain('added.');
    });

    for (const value of ['', '-1', '1.5', '2147483648']) {
      it(kind + ' blocks invalid order ' + JSON.stringify(value), async () => {
        await edit(config);
        await set(prefix, 'order', value);
        save(config);
        http.expectNone(url);
        expect(button(selector, config.save).disabled).toBe(true);
      });
    }

    for (const value of ['   ', 'x'.repeat(max + 1)]) {
      it(kind + ' validates required text and max length ' + value.length, async () => {
        await edit(config);
        await set(prefix, field, value);
        save(config);
        http.expectNone(url);
        expect(button(selector, config.save).disabled).toBe(true);
        expect(element.querySelector('#' + prefix + '-' + field + '-error')!.textContent).toContain(
          'Enter nonblank',
        );
      });
    }

    it(kind + ' 409 retains draft and explains shared-data restrictions safely', async () => {
      await edit(config);
      await set(prefix, field, 'draft');
      save(config);

      fail(http.expectOne(url));
      fixture.detectChanges();
      expect(section(selector).textContent).toContain('shared');
      expect(section(selector).textContent).toContain('Your draft has been kept.');
      expect(element.querySelector<HTMLInputElement>('#' + prefix + '-' + field)!.value).toBe(
        'draft',
      );
      expect(element.textContent).not.toContain('SQL');
      expect(element.textContent).toContain('Core Information');
      expect(element.textContent).toContain('JLPT Levels');
      expect(button(selector, config.save).disabled).toBe(false);
      http.expectNone(getUrl);
    });

    it(
      kind + ' distinguishes committed update from refresh failure and retries only GET',
      async () => {
        await edit(config);
        save(config);

        http.expectOne(url).flush({ success: true, data: result, meta });
        fail(http.expectOne(getUrl), 503);
        fixture.detectChanges();
        expect(section(selector).textContent).toContain('update was saved');
        expect(button(selector, config.save).disabled).toBe(true);
        button(selector, 'Refresh saved details').click();
        fixture.detectChanges();
        http.expectNone(url);
        refresh();
        expect(section(selector).querySelector('form')).toBeNull();
      },
    );

    for (const status of [400, 401, 403, 404, 500]) {
      it(
        kind + ' safely presents HTTP ' + status + ' while retaining the loaded page',
        async () => {
          await edit(config);
          save(config);

          fail(http.expectOne(url), status);
          fixture.detectChanges();
          expect(section(selector).querySelector('[role="alert"]')).not.toBeNull();
          expect(section(selector).querySelector('form')).not.toBeNull();
          expect(element.textContent).not.toContain('SQL');
          expect(element.textContent).toContain('Core Information');
        },
      );
    }

    it(
      kind + ' preserves Add drafts on conflict and recovers a committed POST with GET only',
      async () => {
        button(selector, config.add).click();
        fixture.detectChanges();
        await fixture.whenStable();
        if (kind === 'example') {
          for (const name of [
            'japaneseText',
            'japaneseReading',
            'meaningVi',
            'meaningEn',
            'targetText',
          ])
            await set(prefix, name, 'New ' + name);
        } else if (kind === 'kanji') {
          await set(prefix, 'character', 'D');
        } else {
          await set(prefix, 'reading', 'new reading');
          await set(prefix, 'readingType', 'ON');
        }

        await set(prefix, 'order', '19');
        save(config);

        const postUrl = '/api/v1/admin/vocabularies/73/' + path;

        fail(http.expectOne(postUrl));
        fixture.detectChanges();
        expect(section(selector).textContent).toContain('Your draft has been kept.');
        expect(element.querySelector<HTMLInputElement>('#' + prefix + '-order')!.value).toBe('19');
        save(config);
        http.expectOne(postUrl).flush({ success: true, data: [result], meta });
        fail(http.expectOne(getUrl), 503);
        fixture.detectChanges();
        expect(section(selector).textContent).toContain('addition was saved');
        button(selector, 'Refresh saved details').click();
        fixture.detectChanges();
        http.expectNone(postUrl);

        refresh();

        expect(section(selector).querySelector('form')).toBeNull();
      },
    );

    it(kind + ' cancels pending mutations on route change', async () => {
      await edit(config);
      save(config);

      const pending = http.expectOne(url);

      params.next(convertToParamMap({ vocabularyId: '91' }));
      fixture.detectChanges();
      expect(pending.cancelled).toBe(true);
      http
        .expectOne('/api/v1/flashcards/91')
        .flush({ success: true, data: vocabularyDetailFixture(91), meta });
      fixture.detectChanges();
      expect(element.textContent).not.toContain('Editing ' + config.title);
    });
  }

  it('preserves explicit null versus empty Kanji meanings and permits clearing metadata', async () => {
    const config = configurations[1];

    await edit(config);

    const vi = element.querySelector<HTMLInputElement>('input[name="meaningViUnset"]')!;

    vi.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const en = element.querySelector<HTMLInputElement>('input[name="meaningEnUnset"]')!;

    en.click();
    fixture.detectChanges();
    await fixture.whenStable();
    await set('kanji', 'strokeCount', '0');
    save(config);

    const put = http.expectOne('/api/v1/admin/vocabularies/73/kanji/963');

    expect(put.request.body).toEqual({
      character: 'B',
      strokeCount: 0,
      meaningVi: null,
      meaningEn: '',
      displayOrder: 81,
    });

    put.flush({ success: true, data: { kanjiId: 963 }, meta });
    refresh();
  });

  it('validates optional Kanji lengths and stroke-count bounds', async () => {
    const config = configurations[1];

    await edit(config);
    await set('kanji', 'meaningVi', 'x'.repeat(501));
    save(config);

    http.expectNone((req) => req.method === 'PUT');

    await set('kanji', 'meaningVi', '');

    for (const value of ['-1', '1.5', '65536']) {
      await set('kanji', 'strokeCount', value);

      save(config);
      http.expectNone((req) => req.method === 'PUT');
    }
  });

  it('validates the exact Example target limit and all required fields', async () => {
    const config = configurations[0];

    await edit(config);
    await set('example', 'targetText', 'x'.repeat(201));
    save(config);

    http.expectNone((req) => req.method === 'PUT');

    await set('example', 'targetText', 'target');

    for (const name of ['japaneseReading', 'meaningVi', 'meaningEn']) {
      await set('example', name, '');
      save(config);

      http.expectNone((req) => req.method === 'PUT');

      await set('example', name, 'valid');
    }
  });

  it('requires nonblank Kanji reading type without inventing an enum', async () => {
    const config = configurations[2];

    await edit(config);

    for (const value of ['', 'x'.repeat(21)]) {
      await set(config.prefix, 'readingType', value);
      save(config);
      http.expectNone((req) => req.method === 'PUT');
    }

    await set(config.prefix, 'readingType', 'CUSTOM-TYPE');
    save(config);

    const put = http.expectOne('/api/v1/admin/vocabularies/73/kanji/963/readings/1198');

    expect(put.request.body.readingType).toBe('CUSTOM-TYPE');
    put.flush({ success: true, data: { kanjiReadingId: 1198 }, meta });

    refresh();
  });

  it('targets the first Kanji independently even with matching reading text on another Kanji', async () => {
    const selector = '[data-kanji-id="781"] app-vocabulary-kanji-readings';

    section(selector).querySelector<HTMLButtonElement>('[data-edit-id="812"]')!.click();
    fixture.detectChanges();

    await fixture.whenStable();

    expect(element.querySelector<HTMLInputElement>('#kanji-reading-781-order')!.value).toBe('29');
    button(selector, 'Save kanji reading').click();
    fixture.detectChanges();

    const put = http.expectOne('/api/v1/admin/vocabularies/73/kanji/781/readings/812');

    expect(put.request.body).toEqual({
      reading: 'same reading',
      readingType: 'ON',
      displayOrder: 29,
    });

    put.flush({ success: true, data: { kanjiReadingId: 812 }, meta });
    refresh();
  });

  it('does not let a slower Kanji metadata refresh replace newer nested readings', async () => {
    await edit(configurations[1]);
    save(configurations[1]);

    http
      .expectOne('/api/v1/admin/vocabularies/73/kanji/963')
      .flush({ success: true, data: { kanjiId: 963 }, meta });

    const old = http.expectOne(getUrl);

    await edit(configurations[2]);
    save(configurations[2]);

    http
      .expectOne('/api/v1/admin/vocabularies/73/kanji/963/readings/1198')
      .flush({ success: true, data: { kanjiReadingId: 1198 }, meta });

    http.expectOne(getUrl).flush({
      success: true,
      data: {
        ...detail,
        kanji: detail.kanji.map((item) => ({
          ...item,
          readings: item.readings.map((reading) => ({ ...reading, reading: 'Newest reading' })),
        })),
      },
      meta,
    });

    fixture.detectChanges();
    old.flush({ success: true, data: detail, meta });
    fixture.detectChanges();
    expect(section(configurations[2].selector).textContent).toContain('Newest reading');
  });

  it('nested refresh only updates its Kanji readings, preserving metadata, Examples and other Kanji', async () => {
    await edit(configurations[2]);
    save(configurations[2]);

    http
      .expectOne('/api/v1/admin/vocabularies/73/kanji/963/readings/1198')
      .flush({ success: true, data: { kanjiReadingId: 1198 }, meta });

    const old = http.expectOne(getUrl);

    fixture.componentInstance.updateKanji(
      detail.kanji.map((item) => ({ ...item, character: 'Z' })),
    );

    fixture.componentInstance.updateExamples(
      detail.examples.map((item) => ({ ...item, japaneseText: 'Newest example' })),
    );

    fixture.componentInstance.updateKanjiReadings({
      kanjiId: 781,
      readings: detail.kanji[0].readings.map((item) => ({
        ...item,
        reading: 'Other Kanji newest',
      })),
    });

    fixture.detectChanges();
    old.flush({ success: true, data: detail, meta });
    fixture.detectChanges();

    expect(section('app-vocabulary-examples').textContent).toContain('Newest example');
    expect(section('[data-kanji-id="963"]').querySelector('h3')!.textContent).toContain('Z');
    expect(section('[data-kanji-id="781"]').textContent).toContain('Other Kanji newest');
  });

  it('keeps refresh recovery when a nested mutation succeeded but the Kanji disappears from GET', async () => {
    await edit(configurations[2]);
    save(configurations[2]);

    http
      .expectOne('/api/v1/admin/vocabularies/73/kanji/963/readings/1198')
      .flush({ success: true, data: { kanjiReadingId: 1198 }, meta });
    http.expectOne(getUrl).flush({ success: true, data: { ...detail, kanji: [] }, meta });
    fixture.detectChanges();

    expect(section(configurations[2].selector).textContent).toContain('update was saved');
    button(configurations[2].selector, 'Refresh saved details').click();

    fixture.detectChanges();

    refresh();
  });

  it('maps backend field errors to safe form feedback', async () => {
    await edit(configurations[0]);
    save(configurations[0]);

    http.expectOne('/api/v1/admin/vocabularies/73/examples/845').flush(
      {
        success: false,
        error: {
          code: 'INVALID',
          message: 'SQL',
          details: [{ field: 'targetText', message: 'SQL' }],
        },
        meta,
      },
      { status: 400, statusText: 'Bad request' },
    );

    fixture.detectChanges();
    expect(element.querySelector('#example-targetText-error')!.textContent).toContain(
      'server rejected',
    );

    expect(element.textContent).not.toContain('SQL');
  });
});

describe('Phase 4 read contract', () => {
  it('accepts persisted IDs/orders and nullable Kanji metadata', () =>
    expect(isFlashcard(detail)).toBe(true));
  it.each([
    { ...detail, examples: [{ ...detail.examples[0], exampleId: undefined }] },
    { ...detail, examples: [detail.examples[0], detail.examples[0]] },
    { ...detail, examples: [{ ...detail.examples[0], displayOrder: undefined }] },
    { ...detail, kanji: [{ ...detail.kanji[0], kanjiId: 0 }] },
    { ...detail, kanji: [{ ...detail.kanji[0], displayOrder: -1 }] },
    { ...detail, kanji: [{ ...detail.kanji[0], meaningVi: undefined }] },
    {
      ...detail,
      kanji: [
        {
          ...detail.kanji[0],
          readings: [{ ...detail.kanji[0].readings[0], kanjiReadingId: undefined }],
        },
      ],
    },
    {
      ...detail,
      kanji: [
        {
          ...detail.kanji[0],
          readings: [{ ...detail.kanji[0].readings[0], displayOrder: undefined }],
        },
      ],
    },
    {
      ...detail,
      kanji: [
        {
          ...detail.kanji[0],
          readings: [detail.kanji[0].readings[0], detail.kanji[0].readings[0]],
        },
      ],
    },
  ])('rejects unreliable identity or invalid persisted fields %#', (value) =>
    expect(isFlashcard(value)).toBe(false),
  );
});
