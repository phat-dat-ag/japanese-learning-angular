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

const existing = {
  ...vocabularyDetailFixture(73),
  readings: [
    { readingId: 111, displayOrder: 17, reading: 'にほんご', isPrimary: true, pitchAccents: [0] },
  ],
  meanings: [
    {
      meaningId: 157,
      displayOrder: 29,
      languageCode: 'vi',
      meaning: 'Tiếng Nhật',
      isPrimary: true,
    },
  ],
};

describe.each(['reading', 'meaning'] as const)('Vocabulary %s additions', (kind) => {
  let fixture: ComponentFixture<VocabularyDetail>;
  let http: HttpTestingController;
  let element: HTMLElement;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const cap = kind === 'reading' ? 'Reading' : 'Meaning';
  const url = '/api/v1/admin/vocabularies/73/' + kind + 's';
  const getUrl = '/api/v1/flashcards/73';
  const requestBody =
    kind === 'reading'
      ? { reading: ' にっぽんご ', isPrimary: false, displayOrder: 2 }
      : { language: 'en', meaning: ' Japanese language ', isPrimary: false, displayOrder: 2 };
  const result = kind === 'reading' ? [{ readingId: 91 }] : [{ meaningId: 92 }];

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
    http.expectOne(getUrl).flush({ success: true, data: existing, meta });
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  function section(): HTMLElement {
    return element.querySelector('app-vocabulary-' + kind + 's')!;
  }
  function button(label: string, root: HTMLElement = section()): HTMLButtonElement {
    const found = Array.from(root.querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === label,
    );
    expect(found).toBeDefined();
    return found!;
  }
  async function open(): Promise<void> {
    button('Add ' + cap).click();
    fixture.detectChanges();
    await fixture.whenStable();
  }
  async function input(id: string, value: string): Promise<void> {
    const field = section().querySelector<HTMLInputElement | HTMLTextAreaElement>('#' + id)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    await fixture.whenStable();
  }
  async function draft(): Promise<void> {
    await open();
    await input('new-' + kind, kind === 'reading' ? ' にっぽんご ' : ' Japanese language ');
    await input(kind + '-order', '2');
  }
  function save(): void {
    button('Save ' + kind).click();
    fixture.detectChanges();
  }
  function refresh(): void {
    const data =
      kind === 'reading'
        ? {
            ...existing,
            readings: [
              ...existing.readings,
              {
                readingId: 122,
                displayOrder: 17,
                reading: 'Backend reading',
                isPrimary: false,
                pitchAccents: [],
              },
            ],
          }
        : {
            ...existing,
            meanings: [
              ...existing.meanings,
              {
                meaningId: 170,
                displayOrder: 29,
                languageCode: 'en',
                meaning: 'Backend meaning',
                isPrimary: false,
              },
            ],
          };
    http.expectOne(getUrl).flush({ success: true, data, meta });
    fixture.detectChanges();
  }

  it('renders actual children and primary/language labels with identity-backed Edit controls', () => {
    expect(section().textContent).toContain(kind === 'reading' ? 'にほんご' : 'Tiếng Nhật');
    expect(section().textContent).toContain('Primary');
    if (kind === 'meaning') expect(section().textContent).toContain('Vietnamese (vi)');
    expect(
      Array.from(section().querySelectorAll('button')).some((item) =>
        item.textContent?.includes('Edit'),
      ),
    ).toBe(true);
    http.expectNone((request) => request.method === 'PUT');
  });

  it('opens an explicit add form and cancels without a mutation', async () => {
    await draft();
    expect(section().querySelector('form')).not.toBeNull();
    button('Cancel').click();
    fixture.detectChanges();
    expect(section().querySelector('form')).toBeNull();
    http.expectNone(() => true);
    await open();
    expect(section().querySelector<HTMLInputElement>('#new-' + kind)?.value).toBe('');
  });

  it.each(['', '   ', '\u3000'])('rejects blank text %j', async (text) => {
    await draft();
    await input('new-' + kind, text);
    expect(button('Save ' + kind).disabled).toBe(true);
    section().querySelector('form')!.dispatchEvent(new Event('submit'));
    http.expectNone(() => true);
  });

  it('rejects overlong text', async () => {
    await draft();
    await input('new-' + kind, 'x'.repeat(kind === 'reading' ? 101 : 501));
    expect(button('Save ' + kind).disabled).toBe(true);
    http.expectNone(() => true);
  });

  it.each(['', '-1', '1.5', '2147483648'])('rejects invalid display order %j', async (order) => {
    await draft();
    await input(kind + '-order', order);
    expect(button('Save ' + kind).disabled).toBe(true);
    http.expectNone(() => true);
  });

  it('posts the exact single-item array once and displays authoritative refreshed items', async () => {
    await draft();
    save();
    section().querySelector('form')!.dispatchEvent(new Event('submit'));
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual([requestBody]);
    expect(button('Save ' + kind).disabled).toBe(true);
    expect(button('Cancel').disabled).toBe(true);
    expect(section().textContent).toContain('Saving');
    request.flush({ success: true, data: result, meta });
    fixture.detectChanges();
    expect(section().textContent).toContain('Addition saved. Refreshing');
    refresh();
    expect(section().textContent).toContain('Backend ' + kind);
    expect(section().textContent).toContain(cap + ' added.');
    expect(section().querySelector('form')).toBeNull();
    http.expectNone((request) => request.method === 'PUT');
  });

  it.each([
    [400, 'Check the'],
    [401, 'sign in again'],
    [403, 'permission'],
    [404, 'no longer exists'],
    [409, 'already exists'],
    [500, 'Unable to add'],
  ])('preserves all sections and the draft on HTTP %s', async (status, message) => {
    await draft();
    save();
    http.expectOne(url).flush(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'private SQL diagnostic',
          details: [{ field: kind, message: 'internal exception' }],
        },
        meta,
      },
      { status: Number(status), statusText: 'Error' },
    );
    fixture.detectChanges();
    expect(section().textContent).toContain(message);
    expect(element.textContent).toContain('日本語');
    expect(element.textContent).toContain('にほんご');
    expect(element.textContent).toContain('Tiếng Nhật');
    expect(element.textContent).not.toContain('SQL');
    expect(element.textContent).not.toContain('internal exception');
    expect(section().querySelector<HTMLInputElement>('#new-' + kind)?.value).toBe(
      kind === 'reading' ? ' にっぽんご ' : ' Japanese language ',
    );
    expect(button('Save ' + kind).disabled).toBe(false);
    if (status === 400)
      expect(section().querySelector('#' + kind + '-text-help')?.textContent).toContain(
        'server rejected',
      );
  });

  it('offers a GET-only retry after a committed addition fails to refresh', async () => {
    await draft();
    save();
    http.expectOne(url).flush({ success: true, data: result, meta });
    http.expectOne(getUrl).flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(section().textContent).toContain('addition was saved');
    expect(button('Save ' + kind).disabled).toBe(true);
    button('Refresh saved details').click();
    refresh();
    expect(section().textContent).toContain('Backend ' + kind);
    http.expectNone((request) => request.method === 'POST');
  });

  it('cancels a pending addition immediately when vocabulary ID changes', async () => {
    await draft();
    save();
    const old = http.expectOne(url);
    params.next(convertToParamMap({ vocabularyId: '74' }));
    expect(old.cancelled).toBe(true);
    fixture.detectChanges();
    http
      .expectOne('/api/v1/flashcards/74')
      .flush({ success: true, data: vocabularyDetailFixture(74), meta });
    fixture.detectChanges();
    expect(section().querySelector('form')).toBeNull();
    expect(element.textContent).toContain('Vocabulary ID 74');
  });

  it('cancels a pending post-save refresh on destruction', async () => {
    await draft();
    save();
    http.expectOne(url).flush({ success: true, data: result, meta });
    const request = http.expectOne(getUrl);
    fixture.destroy();
    expect(request.cancelled).toBe(true);
  });

  it('supports maximum text length and int32 display order', async () => {
    await draft();
    await input('new-' + kind, '字'.repeat(kind === 'reading' ? 100 : 500));
    await input(kind + '-order', '2147483647');
    save();
    const request = http.expectOne(url);
    expect(request.request.body[0].displayOrder).toBe(2147483647);
    request.flush(null, { status: 500, statusText: 'Error' });
  });
});

describe('Independent vocabulary sections', () => {
  let fixture: ComponentFixture<VocabularyDetail>;
  let http: HttpTestingController;
  let element: HTMLElement;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [VocabularyDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: new BehaviorSubject(convertToParamMap({ vocabularyId: '73' })) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(VocabularyDetail);
    element = fixture.nativeElement;
    fixture.detectChanges();
    http.expectOne('/api/v1/flashcards/73').flush({ success: true, data: existing, meta });
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  function click(text: string): void {
    const button = Array.from(element.querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === text,
    )!;
    button.click();
    fixture.detectChanges();
  }
  async function input(id: string, value: string): Promise<void> {
    const field = element.querySelector<HTMLInputElement>('#' + id)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('preserves independent drafts and merges out-of-order section refreshes', async () => {
    click('Add Reading');
    click('Add Meaning');
    await fixture.whenStable();
    await input('new-reading', 'Reading draft');
    await input('reading-order', '0');
    await input('new-meaning', 'Meaning draft');
    await input('meaning-order', '0');
    click('Save reading');
    http
      .expectOne('/api/v1/admin/vocabularies/73/readings')
      .flush({ success: true, data: [{ readingId: 91 }], meta });
    const readingRefresh = http.expectOne('/api/v1/flashcards/73');
    expect(element.querySelector<HTMLInputElement>('#new-meaning')?.value).toBe('Meaning draft');
    click('Save meaning');
    http
      .expectOne('/api/v1/admin/vocabularies/73/meanings')
      .flush({ success: true, data: [{ meaningId: 92 }], meta });
    http.expectOne('/api/v1/flashcards/73').flush({
      success: true,
      data: {
        ...existing,
        meanings: [
          {
            meaningId: 183,
            displayOrder: 29,
            languageCode: 'en',
            meaning: 'New authoritative meaning',
            isPrimary: false,
          },
        ],
      },
      meta,
    });
    fixture.detectChanges();
    readingRefresh.flush({
      success: true,
      data: {
        ...existing,
        readings: [
          {
            readingId: 133,
            displayOrder: 17,
            reading: 'New authoritative reading',
            isPrimary: true,
            pitchAccents: [],
          },
        ],
      },
      meta,
    });
    fixture.detectChanges();
    expect(element.textContent).toContain('New authoritative meaning');
    expect(element.textContent).toContain('New authoritative reading');
  });

  it('requires a primary reading when none is loaded', async () => {
    fixture.componentInstance.updateReadings([]);
    fixture.detectChanges();
    click('Add Reading');
    await fixture.whenStable();
    await input('new-reading', 'First reading');
    await input('reading-order', '0');
    const save = Array.from(element.querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === 'Save reading',
    )!;
    expect(save.disabled).toBe(true);
    element
      .querySelector<HTMLInputElement>('app-vocabulary-reading-form input[type="checkbox"]')!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    save.click();
    const request = http.expectOne('/api/v1/admin/vocabularies/73/readings');
    expect(request.request.body).toEqual([
      { reading: 'First reading', isPrimary: true, displayOrder: 0 },
    ]);
    request.flush(null, { status: 500, statusText: 'Error' });
  });

  it('offers exactly the documented meaning languages', async () => {
    click('Add Meaning');
    await fixture.whenStable();
    const select = element.querySelector<HTMLSelectElement>('#meaning-language')!;
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['en', 'vi']);
    select.value = 'vi';
    select.dispatchEvent(new Event('change'));
    await input('new-meaning', 'Nghĩa');
    await input('meaning-order', '0');
    click('Save meaning');
    const request = http.expectOne('/api/v1/admin/vocabularies/73/meanings');
    expect(request.request.body).toEqual([
      { language: 'vi', meaning: 'Nghĩa', isPrimary: false, displayOrder: 0 },
    ]);
    request.flush(null, { status: 500, statusText: 'Error' });
  });

  it('does not overwrite refreshed readings when an older core refresh finishes later', async () => {
    click('Edit core information');
    await fixture.whenStable();
    await input('core-word', 'Updated core word');
    click('Save changes');
    http
      .expectOne('/api/v1/admin/vocabularies/73')
      .flush({ success: true, data: { vocabularyId: 73 }, meta });
    const coreRefresh = http.expectOne('/api/v1/flashcards/73');

    click('Add Reading');
    await fixture.whenStable();
    await input('new-reading', 'New reading');
    await input('reading-order', '1');
    click('Save reading');
    http
      .expectOne('/api/v1/admin/vocabularies/73/readings')
      .flush({ success: true, data: [{ readingId: 91 }], meta });
    http.expectOne('/api/v1/flashcards/73').flush({
      success: true,
      data: {
        ...existing,
        readings: [
          {
            readingId: 144,
            displayOrder: 17,
            reading: 'Refreshed reading',
            isPrimary: true,
            pitchAccents: [],
          },
        ],
      },
      meta,
    });
    fixture.detectChanges();

    coreRefresh.flush({
      success: true,
      data: {
        ...existing,
        vocabulary: { ...existing.vocabulary, word: 'Updated core word' },
      },
      meta,
    });
    fixture.detectChanges();
    expect(element.textContent).toContain('Updated core word');
    expect(element.textContent).toContain('Refreshed reading');
    expect(element.textContent).toContain('Tiếng Nhật');
    expect(element.querySelector('app-vocabulary-core-form')).toBeNull();
  });
});
