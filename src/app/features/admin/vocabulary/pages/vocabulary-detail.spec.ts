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

describe('Admin vocabulary detail and core editing', () => {
  let fixture: ComponentFixture<VocabularyDetail>;
  let http: HttpTestingController;
  let element: HTMLElement;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const getUrl = '/api/v1/flashcards/42';
  const putUrl = '/api/v1/admin/vocabularies/42';

  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ vocabularyId: '42' }));
    TestBed.configureTestingModule({
      imports: [VocabularyDetail],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function create(): void {
    fixture = TestBed.createComponent(VocabularyDetail);
    element = fixture.nativeElement;
    fixture.detectChanges();
  }

  function load(id = 42): void {
    http
      .expectOne('/api/v1/flashcards/' + id)
      .flush({ success: true, data: vocabularyDetailFixture(id), meta });
    fixture.detectChanges();
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(element.querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === label,
    );
    expect(found).toBeDefined();
    return found!;
  }

  async function edit(): Promise<void> {
    button('Edit core information').click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function fill(word: string, normalizedWord: string): Promise<void> {
    for (const [id, value] of [
      ['core-word', word],
      ['core-normalized-word', normalizedWord],
    ]) {
      const input = element.querySelector<HTMLInputElement>('#' + id)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
    }

    fixture.detectChanges();
    await fixture.whenStable();
  }

  function save(): void {
    button('Save changes').click();
    fixture.detectChanges();
  }

  it('loads a validated ID and renders actual core values', () => {
    create();

    expect(element.textContent).toContain('Loading vocabulary details');
    expect(element.querySelector('[aria-busy]')?.getAttribute('aria-busy')).toBe('true');

    const request = http.expectOne(getUrl);

    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: vocabularyDetailFixture(), meta });

    fixture.detectChanges();

    expect(element.textContent).toContain('Vocabulary ID 42');
    expect(element.textContent).toContain('日本語');
    expect(element.textContent).toContain('にほんご');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/admin/vocabulary');
  });

  it.each(['', '0', '-1', 'abc', '1.5', '9007199254740992'])(
    'rejects invalid ID %s without HTTP',
    (id) => {
      params.next(convertToParamMap({ vocabularyId: id }));
      create();
      expect(element.textContent).toContain('Invalid vocabulary ID');
      http.expectNone(() => true);
    },
  );

  it('shows a not-found state', () => {
    create();
    http.expectOne(getUrl).flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(element.textContent).toContain('Vocabulary not found');
    expect(element.querySelector('form')).toBeNull();
  });

  it('shows safe errors and retries loading', () => {
    create();
    http.expectOne(getUrl).flush('private SQL diagnostic', { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(element.textContent).toContain('Unable to load vocabulary details');
    expect(element.textContent).not.toContain('SQL');
    button('Try again').click();
    load();
  });

  it('cancels stale requests and removes old details when the route changes', () => {
    create();

    const old = http.expectOne(getUrl);

    params.next(convertToParamMap({ vocabularyId: '73' }));
    fixture.detectChanges();
    expect(old.cancelled).toBe(true);
    load(73);
    expect(element.textContent).toContain('Vocabulary ID 73');
    params.next(convertToParamMap({ vocabularyId: '74' }));
    fixture.detectChanges();
    expect(element.textContent).not.toContain('Vocabulary ID 73');
    load(74);
  });

  it('initializes editing from the backend and cancels without PUT', async () => {
    create();
    load();
    await edit();

    expect(element.querySelector<HTMLInputElement>('#core-word')?.value).toBe('日本語');
    expect(element.querySelector<HTMLInputElement>('#core-normalized-word')?.value).toBe(
      'にほんご',
    );

    await fill('Draft', 'draft');

    button('Cancel').click();
    fixture.detectChanges();
    expect(element.querySelector('form')).toBeNull();
    expect(element.textContent).toContain('日本語');
    expect(element.textContent).not.toContain('Draft');
    http.expectNone((request) => request.method === 'PUT');

    await edit();

    expect(element.querySelector<HTMLInputElement>('#core-word')?.value).toBe('日本語');
  });

  it.each([
    ['', 'valid'],
    ['  \t\n', 'valid'],
    ['\u3000', 'valid'],
    ['valid', ''],
    ['valid', ' '.repeat(3)],
    ['x'.repeat(101), 'valid'],
    ['valid', 'x'.repeat(101)],
  ])('prevents invalid core submission (%j, %j)', async (word, normalizedWord) => {
    create();
    load();
    await edit();
    await fill(word, normalizedWord);

    expect(button('Save changes').disabled).toBe(true);
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    http.expectNone((request) => request.method === 'PUT');
    expect(element.querySelector('[aria-invalid="true"]')).not.toBeNull();
  });

  it('sends exactly the entered fields once, then displays authoritative refreshed data', async () => {
    create();
    load();
    await edit();
    await fill(' 日本 ', 'にほん');
    save();

    fixture.componentInstance.save({ word: 'Duplicate', normalizedWord: 'duplicate' });

    const request = http.expectOne(putUrl);

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ word: ' 日本 ', normalizedWord: 'にほん' });
    expect(button('Save changes').disabled).toBe(true);
    expect(button('Cancel').disabled).toBe(true);
    expect(element.textContent).toContain('Saving core information');
    request.flush({ success: true, data: { vocabularyId: 42 }, meta });
    fixture.detectChanges();
    expect(element.textContent).toContain('Changes saved. Refreshing');

    const refreshed = vocabularyDetailFixture();

    http.expectOne(getUrl).flush({
      success: true,
      data: {
        ...refreshed,
        vocabulary: {
          id: 42,
          word: 'Authoritative word',
          normalizedWord: 'authoritative normalized',
        },
      },
      meta,
    });

    fixture.detectChanges();
    expect(element.querySelector('form')).toBeNull();
    expect(element.textContent).toContain('Authoritative word');
    expect(element.textContent).toContain('authoritative normalized');
    expect(element.textContent).toContain('Core information saved');
    http.expectNone((r) => r.method === 'PUT');
  });

  it('accepts the documented maximum lengths', async () => {
    create();
    load();
    await edit();
    await fill('字'.repeat(100), 'あ'.repeat(100));
    save();
    http.expectOne(putUrl).flush(null, { status: 500, statusText: 'Error' });
  });

  it('maps field validation safely and retains both loaded details and the draft', async () => {
    create();
    load();
    await edit();
    await fill('Draft', 'draft');
    save();

    http.expectOne(putUrl).flush(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'private SQL',
          details: [
            { field: 'word', message: 'private SQL' },
            { field: 'unknown', message: 'private SQL' },
          ],
        },
        meta,
      },
      { status: 400, statusText: 'Bad Request' },
    );

    fixture.detectChanges();

    expect(element.textContent).toContain('Please check the core information');
    expect(element.querySelector('#core-word-help')?.textContent).toContain('server rejected');
    expect(element.textContent).not.toContain('SQL');
    expect(element.textContent).toContain('日本語');
    expect(element.querySelector<HTMLInputElement>('#core-word')?.value).toBe('Draft');
    expect(button('Save changes').disabled).toBe(false);
    button('Cancel').click();

    fixture.detectChanges();

    expect(element.textContent).toContain('にほんご');
  });

  it.each([
    [400, 'Please check'],
    [401, 'sign in again'],
    [403, 'permission'],
    [404, 'no longer exists'],
    [409, 'already used'],
    [500, 'Unable to save'],
  ])('handles save status %s without discarding the draft', async (status, message) => {
    create();
    load();
    await edit();
    await fill('Draft', 'draft');
    save();

    http
      .expectOne(putUrl)
      .flush('private diagnostic', { status: Number(status), statusText: 'Error' });
    fixture.detectChanges();

    expect(element.textContent).toContain(message);
    expect(element.textContent).not.toContain('private diagnostic');
    expect(element.querySelector<HTMLInputElement>('#core-word')?.value).toBe('Draft');
  });

  it('retries only GET when a committed save cannot be refreshed', async () => {
    create();
    load();
    await edit();
    await fill('Draft', 'draft');
    save();

    http.expectOne(putUrl).flush({ success: true, data: { vocabularyId: 42 }, meta });
    http.expectOne(getUrl).flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(element.textContent).toContain('Changes were saved');
    expect(button('Save changes').disabled).toBe(true);
    expect(button('Cancel').disabled).toBe(true);
    button('Refresh saved details').click();

    load();

    expect(element.querySelector('form')).toBeNull();
    http.expectNone((r) => r.method === 'PUT');
  });

  it('cancels a pending save and clears edit state when the route changes', async () => {
    create();
    load();
    await edit();
    await fill('Draft', 'draft');
    save();

    const old = http.expectOne(putUrl);

    params.next(convertToParamMap({ vocabularyId: '73' }));
    fixture.detectChanges();
    expect(old.cancelled).toBe(true);
    expect(element.querySelector('form')).toBeNull();

    load(73);

    expect(element.textContent).toContain('Vocabulary ID 73');
    expect(element.textContent).not.toContain('Draft');
  });

  it('cancels pending detail work when destroyed', () => {
    create();
    const request = http.expectOne(getUrl);
    fixture.destroy();
    expect(request.cancelled).toBe(true);
  });
});
