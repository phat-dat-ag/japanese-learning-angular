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

const detail = {
  ...vocabularyDetailFixture(73),
  readings: [
    {
      readingId: 415,
      reading: 'にほんご',
      isPrimary: true,
      displayOrder: 17,
      pitchAccentDetails: [],
      pitchAccents: [0],
    },
    {
      readingId: 887,
      reading: 'にっぽんご',
      isPrimary: false,
      displayOrder: 43,
      pitchAccentDetails: [],
      pitchAccents: [],
    },
  ],
  meanings: [
    { meaningId: 529, languageCode: 'en', meaning: 'Japanese', isPrimary: false, displayOrder: 23 },
    {
      meaningId: 992,
      languageCode: 'vi',
      meaning: 'Tiếng Nhật',
      isPrimary: true,
      displayOrder: 61,
    },
  ],
};

describe.each(['reading', 'meaning'] as const)('Vocabulary %s editing', (kind) => {
  let fixture: ComponentFixture<VocabularyDetail>;
  let http: HttpTestingController;
  let element: HTMLElement;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const childId = kind === 'reading' ? 887 : 992;
  const persistedText = kind === 'reading' ? 'にっぽんご' : 'Tiếng Nhật';
  const persistedOrder = kind === 'reading' ? 43 : 61;
  const url = '/api/v1/admin/vocabularies/73/' + kind + 's/' + childId;
  const getUrl = '/api/v1/flashcards/73';
  const result = kind === 'reading' ? { readingId: 887 } : { meaningId: 992 };

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

  function section(): HTMLElement {
    return element.querySelector('app-vocabulary-' + kind + 's')!;
  }

  function button(text: string): HTMLButtonElement {
    const found = Array.from(section().querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === text,
    );
    expect(found).toBeDefined();
    return found!;
  }

  async function edit(id = childId): Promise<void> {
    section()
      .querySelector<HTMLButtonElement>('[data-child-id="' + id + '"]')!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function input(id: string, value: string): Promise<void> {
    const control = section().querySelector<HTMLInputElement | HTMLTextAreaElement>('#' + id)!;
    control.value = value;
    control.dispatchEvent(new Event('input'));
    control.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function save(): void {
    button('Save ' + kind).click();
    fixture.detectChanges();
  }

  function refresh(): void {
    http.expectOne(getUrl).flush({
      success: true,
      data:
        kind === 'reading'
          ? {
            ...detail,
            readings: [
              detail.readings[0],
              { ...detail.readings[1], reading: 'Authoritative reading', displayOrder: 71 },
            ],
          }
          : {
            ...detail,
            meanings: [
              detail.meanings[0],
              { ...detail.meanings[1], meaning: 'Authoritative meaning', displayOrder: 82 },
            ],
          },
      meta,
    });
    fixture.detectChanges();
  }

  it('renders identity-backed actions and initializes the exact selected item and persisted order', async () => {
    expect(section().querySelectorAll('button[data-child-id]')).toHaveLength(2);
    expect(
      section()
        .querySelector('[data-child-id="' + childId + '"]')
        ?.getAttribute('aria-label'),
    ).toContain(persistedText);

    await edit();

    expect(section().textContent).toContain(
      kind === 'reading' ? 'Editing Reading' : 'Editing Meaning',
    );

    expect(section().querySelector<HTMLInputElement>('#new-' + kind)?.value).toBe(persistedText);
    expect(section().querySelector<HTMLInputElement>('#' + kind + '-order')?.value).toBe(
      String(persistedOrder),
    );

    expect(section().querySelector<HTMLInputElement>('input[name="isPrimary"]')?.checked).toBe(
      kind === 'meaning',
    );

    if (kind === 'meaning')
      expect(section().querySelector<HTMLSelectElement>('#meaning-language')?.value).toBe('vi');

    expect(
      Array.from(section().querySelectorAll<HTMLButtonElement>('button[data-child-id]')).every(
        (item) => item.disabled,
      ),
    ).toBe(true);
  });

  it('cancels without HTTP and starts Add with a fresh draft', async () => {
    await edit();
    await input('new-' + kind, 'Discard this');

    button('Cancel').click();
    fixture.detectChanges();

    await fixture.whenStable();
    expect(section().querySelector('form')).toBeNull();
    expect(document.activeElement?.getAttribute('data-child-id')).toBe(String(childId));
    http.expectNone(() => true);
    button(kind === 'reading' ? 'Add Reading' : 'Add Meaning').click();
    fixture.detectChanges();

    await fixture.whenStable();
    expect(section().querySelector<HTMLInputElement>('#new-' + kind)?.value).toBe('');
    expect(section().querySelector<HTMLInputElement>('#' + kind + '-order')?.value).toBe('');
  });

  it('sends one exact object PUT to the real child ID, then refetches authoritative detail', async () => {
    await edit();
    await input('new-' + kind, ' Edited value ');

    save();
    section().querySelector('form')!.dispatchEvent(new Event('submit'));

    const request = http.expectOne(url);

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(
      kind === 'reading'
        ? { reading: ' Edited value ', isPrimary: false, displayOrder: 43 }
        : { language: 'vi', meaning: ' Edited value ', isPrimary: true, displayOrder: 61 },
    );
    expect(Array.isArray(request.request.body)).toBe(false);
    expect(request.request.body.languageCode).toBeUndefined();
    expect(button('Save ' + kind).disabled).toBe(true);
    expect(button('Cancel').disabled).toBe(true);
    request.flush({ success: true, data: result, meta });
    fixture.detectChanges();
    expect(section().textContent).toContain('Changes saved');
    refresh();
    expect(section().querySelector('form')).toBeNull();
    expect(section().textContent).toContain('Authoritative ' + kind);
    expect(section().textContent).toContain('updated.');
    expect(section().textContent).toContain(kind === 'reading' ? '71' : '82');
    http.expectNone((request) => request.method === 'POST');
  });

  it.each(['', '  ', 'long'])('blocks invalid edit text %j', async (value) => {
    await edit();
    await input(
      'new-' + kind,
      value === 'long' ? 'x'.repeat(kind === 'reading' ? 101 : 501) : value,
    );

    expect(button('Save ' + kind).disabled).toBe(true);
    section().querySelector('form')!.dispatchEvent(new Event('submit'));
    http.expectNone(() => true);
  });

  it.each(['', '-1', '1.5', '2147483648'])('blocks invalid edit order %j', async (value) => {
    await edit();
    await input(kind + '-order', value);

    expect(button('Save ' + kind).disabled).toBe(true);
    section().querySelector('form')!.dispatchEvent(new Event('submit'));
    http.expectNone(() => true);
  });

  it.each([400, 401, 403, 404, 409, 500])(
    'preserves the draft and other sections on PUT %s',
    async (status) => {
      await edit();
      await input('new-' + kind, 'Preserved draft');

      save();
      http.expectOne(url).flush(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'private SQL',
            details: [{ field: kind, message: 'internal stack' }],
          },
          meta,
        },
        { status, statusText: 'Error' },
      );

      fixture.detectChanges();
      expect(section().querySelector('[role="alert"]')).not.toBeNull();
      expect(section().querySelector<HTMLInputElement>('#new-' + kind)?.value).toBe(
        'Preserved draft',
      );
      expect(element.textContent).toContain('日本語');
      expect(element.textContent).toContain('Tiếng Nhật');
      expect(element.textContent).toContain('にほんご');
      expect(element.textContent).not.toContain('private SQL');
      expect(element.textContent).not.toContain('internal stack');
      expect(button('Save ' + kind).disabled).toBe(false);
    },
  );

  it('retries only GET after successful PUT followed by refresh failure', async () => {
    await edit();
    save();

    http.expectOne(url).flush({ success: true, data: result, meta });
    http.expectOne(getUrl).flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(section().textContent).toContain('update was saved');
    expect(button('Save ' + kind).disabled).toBe(true);

    button('Refresh saved details').click();
    refresh();

    expect(section().textContent).toContain('updated.');
    http.expectNone((request) => request.method !== 'GET');
  });

  it('cancels pending PUT and clears editing on a vocabulary route change', async () => {
    await edit();
    save();

    const request = http.expectOne(url);

    params.next(convertToParamMap({ vocabularyId: '74' }));
    expect(request.cancelled).toBe(true);
    fixture.detectChanges();
    http
      .expectOne('/api/v1/flashcards/74')
      .flush({ success: true, data: vocabularyDetailFixture(74), meta });
    fixture.detectChanges();

    expect(section().querySelector('form')).toBeNull();
    expect(element.textContent).toContain('Vocabulary ID 74');
  });

  if (kind === 'reading') {
    it('does not count the edited reading as another primary', async () => {
      await edit(415);

      const checkbox = section().querySelector<HTMLInputElement>('input[name="isPrimary"]')!;

      expect(checkbox.checked).toBe(true);
      checkbox.click();
      fixture.detectChanges();

      await fixture.whenStable();

      expect(button('Save reading').disabled).toBe(true);
      http.expectNone(() => true);
    });

    it('allows multiple primaries and demoting one when another primary exists', async () => {
      fixture.componentInstance.updateReadings(
        detail.readings.map((item) => ({ ...item, isPrimary: true })),
      );
      fixture.detectChanges();

      await edit();

      section().querySelector<HTMLInputElement>('input[name="isPrimary"]')!.click();
      fixture.detectChanges();

      await fixture.whenStable();

      expect(button('Save reading').disabled).toBe(false);
      save();
      expect(http.expectOne(url).request.body).toEqual({
        reading: 'にっぽんご',
        isPrimary: false,
        displayOrder: 43,
      });
    });
  }
});
