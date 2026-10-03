import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { VocabularyDetail } from './vocabulary-detail';
import { VocabularyList } from './vocabulary-list';
import { contentDetail } from '../testing/vocabulary-content.fixture';
import {
  vocabularyDetailFixture,
  vocabularyMeta as meta,
} from '../testing/vocabulary-detail.fixture';
import { authInterceptor } from '../../../../core/auth/auth.interceptor';
import { AuthSession } from '../../../../core/auth/auth-session.service';

const detail = {
  ...contentDetail,
  readings: [
    {
      readingId: 415,
      reading: 'reading',
      isPrimary: true,
      displayOrder: 17,
      pitchAccents: [2],
      pitchAccentDetails: [{ pitchAccentId: 827, accentPattern: 2 }],
    },
  ],
  meanings: [
    { meaningId: 529, languageCode: 'en', meaning: 'meaning', isPrimary: true, displayOrder: 23 },
  ],
  levels: [{ levelId: 51, code: 'N5', name: 'JLPT N5', displayOrder: 19 }],
};

describe('Integrated vocabulary form accessibility and recovery', () => {
  let fixture: ComponentFixture<VocabularyDetail>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [VocabularyDetail],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: new BehaviorSubject(convertToParamMap({ vocabularyId: '73' })) },
        },
      ],
    });

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function create(data = detail): void {
    fixture = TestBed.createComponent(VocabularyDetail);
    element = fixture.nativeElement;
    fixture.detectChanges();
    http.expectOne('/api/v1/flashcards/73').flush({ success: true, data, meta });
    fixture.detectChanges();
  }

  function section(selector: string): HTMLElement {
    return element.querySelector(selector)!;
  }

  function button(selector: string, label: string): HTMLButtonElement {
    const found = Array.from(section(selector).querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === label,
    );

    expect(found).toBeDefined();
    return found!;
  }

  async function open(selector: string, label: string): Promise<void> {
    button(selector, label).click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function set(id: string, value: string): Promise<void> {
    const input = element.querySelector<HTMLInputElement>('#' + id)!;

    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    await fixture.whenStable();
  }

  const forms = [
    {
      selector: 'app-vocabulary-core-form',
      container: 'app-vocabulary-section',
      open: 'Edit core information',
      field: 'core-word',
      invalid: '',
      save: 'Save changes',
    },
    {
      selector: 'app-vocabulary-reading-form',
      container: 'app-vocabulary-readings',
      open: 'Add Reading',
      field: 'new-reading',
      invalid: ' ',
      save: 'Save reading',
    },
    {
      selector: 'app-vocabulary-meaning-form',
      container: 'app-vocabulary-meanings',
      open: 'Add Meaning',
      field: 'new-meaning',
      invalid: ' ',
      save: 'Save meaning',
    },
    {
      selector: 'app-vocabulary-pitch-accent-form',
      container: 'app-vocabulary-metadata-section:has(#pitch-accents-heading)',
      open: 'Add pitch accent',
      field: 'accent-pattern',
      invalid: '-1',
      save: 'Save pitch accent',
    },
    {
      selector: 'app-vocabulary-level-assignment-form',
      container: 'app-vocabulary-metadata-section:has(#levels-heading)',
      open: 'Add level assignment',
      field: 'level-assignment-order',
      invalid: '-1',
      save: 'Save level assignment',
    },
    {
      selector: 'app-vocabulary-lesson-assignment-form',
      container: 'app-vocabulary-metadata-section:has(#lessons-heading)',
      open: 'Add lesson assignment',
      field: 'lesson-assignment-order',
      invalid: '0',
      save: 'Save lesson assignment',
    },
    {
      selector: 'app-vocabulary-part-of-speech-form',
      container: 'app-vocabulary-metadata-section:has(#parts-of-speech-heading)',
      open: 'Add part of speech',
      field: 'part-of-speech-code',
      invalid: ' ',
      save: 'Save part of speech',
    },
    {
      selector: 'app-vocabulary-example-form',
      container: 'app-vocabulary-examples',
      open: 'Add example',
      field: 'example-targetText',
      invalid: ' ',
      save: 'Save example',
    },
    {
      selector: 'app-vocabulary-kanji-form',
      container: 'app-vocabulary-kanji',
      open: 'Add or attach kanji',
      field: 'kanji-character',
      invalid: ' ',
      save: 'Save kanji',
    },
    {
      selector: 'app-vocabulary-kanji-reading-form',
      container: '[data-kanji-id="963"] app-vocabulary-kanji-readings',
      open: 'Add kanji reading',
      field: 'kanji-reading-963-readingType',
      invalid: ' ',
      save: 'Save kanji reading',
    },
  ] as const;

  for (const item of forms) {
    it(
      item.selector +
      ' uses shared semantic actions, required labels and invalid-field associations',
      async () => {
        create();
        await open(item.container, item.open);

        if (item.selector === 'app-vocabulary-level-assignment-form') {
          http
            .expectOne('/api/v1/jlpt-levels')
            .flush({ success: true, data: [{ code: 'N4', name: 'JLPT N4' }], meta });
          fixture.detectChanges();
        }

        const form = section(item.selector);

        expect(form.querySelector('app-vocabulary-form-actions')).not.toBeNull();
        expect(button(item.selector, item.save).type).toBe('submit');
        expect(button(item.selector, 'Cancel').type).toBe('button');

        for (const control of form.querySelectorAll<HTMLInputElement>(
          'input[required],select[required],textarea[required]',
        )) {
          const label = Array.from(form.querySelectorAll('label')).find(
            (label) => label.htmlFor === control.id,
          );

          expect(label?.textContent?.match(/\(required\)/g)).toHaveLength(1);
        }

        for (const checkbox of form.querySelectorAll('input[type="checkbox"]')) {
          expect(checkbox.closest('label')?.textContent).not.toContain('(required)');
        }

        expect(form.contains(document.activeElement)).toBe(true);
        await set(item.field, item.invalid);

        const control = form.querySelector<HTMLInputElement>('#' + item.field)!;

        expect(control.getAttribute('aria-invalid')).toBe('true');

        const ids = control.getAttribute('aria-describedby')!.split(' ');

        expect(ids.every((id) => element.querySelector('#' + id) !== null)).toBe(true);
        expect(button(item.selector, item.save).disabled).toBe(true);
        button(item.selector, 'Cancel').click();
        fixture.detectChanges();

        await fixture.whenStable();

        expect(document.activeElement).toBe(button(item.container, item.open));
        http.expectNone((request) => request.method !== 'GET');
      },
    );
  }

  it('has unique IDs and meaningful checkbox labels with simultaneous nested forms', async () => {
    create();
    await open('[data-kanji-id="781"] app-vocabulary-kanji-readings', 'Add kanji reading');
    await open('[data-kanji-id="963"] app-vocabulary-kanji-readings', 'Add kanji reading');
    await open('app-vocabulary-kanji', 'Add or attach kanji');

    const ids = Array.from(element.querySelectorAll('[id]')).map((node) => node.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(element.querySelector('input[name="meaningViUnset"]')?.getAttribute('aria-label')).toBe(
      'Vietnamese meaning not specified',
    );
    expect(element.querySelector('input[name="meaningEnUnset"]')?.getAttribute('aria-label')).toBe(
      'English meaning not specified',
    );
  });

  it('explains missing readings instead of leaving a silently unusable pitch form', async () => {
    create({ ...detail, readings: [] });
    await open('app-vocabulary-metadata-section:has(#pitch-accents-heading)', 'Add pitch accent');

    expect(section('app-vocabulary-pitch-accent-form').textContent).toContain(
      'Add a reading in the Readings section',
    );

    expect(button('app-vocabulary-pitch-accent-form', 'Save pitch accent').disabled).toBe(true);
  });

  it('explains empty level and lesson master choices and disables dependent lesson selection', async () => {
    create();
    await open('app-vocabulary-metadata-section:has(#levels-heading)', 'Add level assignment');

    http.expectOne('/api/v1/jlpt-levels').flush({ success: true, data: [], meta });
    fixture.detectChanges();
    expect(section('app-vocabulary-level-assignment-form').textContent).toContain(
      'No JLPT levels are available',
    );

    await open('app-vocabulary-metadata-section:has(#lessons-heading)', 'Add lesson assignment');

    const lesson = element.querySelector<HTMLSelectElement>('#assignment-lesson')!;

    expect(lesson.disabled).toBe(true);

    const level = element.querySelector<HTMLSelectElement>('#lesson-level')!;

    level.value = 'N5';
    level.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    await fixture.whenStable();

    expect(lesson.disabled).toBe(true);
    expect(lesson.getAttribute('aria-busy')).toBe('true');
    http.expectOne('/api/v1/lessons?level=n5').flush({ success: true, data: [], meta });
    fixture.detectChanges();
    expect(section('app-vocabulary-lesson-assignment-form').textContent).toContain(
      'No lessons are available for the selected level',
    );
  });

  it('retains permission-specific detail load feedback without exposing diagnostics', () => {
    fixture = TestBed.createComponent(VocabularyDetail);
    element = fixture.nativeElement;
    fixture.detectChanges();
    http
      .expectOne('/api/v1/flashcards/73')
      .flush(
        { success: false, error: { code: 'DENIED', message: 'SQL internals', details: [] }, meta },
        { status: 403, statusText: 'Forbidden' },
      );
    fixture.detectChanges();
    expect(element.textContent).toContain('You do not have permission');
    expect(element.textContent).not.toContain('SQL');
  });

  it('rotates authentication for an Admin PUT, preserves its object body and refetches with the new token', async () => {
    const session = TestBed.inject(AuthSession);

    session.replace({ accessToken: 'old', refreshToken: 'refresh-old', expiresIn: 60 });
    session.setUser({ userId: 'admin', username: 'Admin', role: 'Admin' });
    create();

    await open('app-vocabulary-section', 'Edit core information');

    button('app-vocabulary-core-form', 'Save changes').click();
    fixture.detectChanges();

    const initial = http.expectOne('/api/v1/admin/vocabularies/73');
    const body = initial.request.body;

    expect(initial.request.headers.get('Authorization')).toBe('Bearer old');
    initial.flush(null, { status: 401, statusText: 'Expired' });
    http
      .expectOne('/api/auth/refresh')
      .flush({ accessToken: 'new', refreshToken: 'refresh-new', expiresIn: 60 });

    const retried = http.expectOne('/api/v1/admin/vocabularies/73');

    expect(retried.request.body).toEqual(body);
    expect(retried.request.headers.get('Authorization')).toBe('Bearer new');
    retried.flush({ success: true, data: { vocabularyId: 73 }, meta });

    const get = http.expectOne('/api/v1/flashcards/73');

    expect(get.request.headers.get('Authorization')).toBe('Bearer new');
    get.flush({ success: true, data: detail, meta });
    fixture.detectChanges();
    expect(element.textContent).toContain('Core information saved.');
  });

  it('keeps committed-save recovery distinct when session refresh fails during the follow-up GET', async () => {
    const session = TestBed.inject(AuthSession);

    session.replace({ accessToken: 'old', refreshToken: 'refresh-old', expiresIn: 60 });
    session.setUser({ userId: 'admin', username: 'Admin', role: 'Admin' });
    create();

    await open('app-vocabulary-section', 'Edit core information');

    button('app-vocabulary-core-form', 'Save changes').click();
    fixture.detectChanges();
    http
      .expectOne('/api/v1/admin/vocabularies/73')
      .flush({ success: true, data: { vocabularyId: 73 }, meta });
    http.expectOne('/api/v1/flashcards/73').flush(null, { status: 401, statusText: 'Expired' });
    http.expectOne('/api/auth/refresh').flush(null, { status: 401, statusText: 'Expired' });
    fixture.detectChanges();

    expect(session.authenticated()).toBe(false);
    expect(element.textContent).toContain('Changes were saved');
    expect(button('app-vocabulary-core-form', 'Save changes').disabled).toBe(true);

    http.expectNone((request) => request.method === 'PUT');
  });
});

describe('Vocabulary list keyboard and load-error integration', () => {
  let fixture: ComponentFixture<VocabularyList>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [VocabularyList],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(VocabularyList);
    element = fixture.nativeElement;
    fixture.detectChanges();
    http.expectOne('/api/v1/jlpt-levels').flush({ success: true, data: [], meta });
  });

  afterEach(() => http.verify());

  it('keeps focus on the result heading through pagination loading', () => {
    http.expectOne('/api/v1/flashcards?page=0&size=20').flush({
      success: true,
      data: {
        flashcardItems: [{ id: 73, word: 'word' }],
        page: 0,
        size: 20,
        totalPages: 2,
        totalElements: 21,
      },
      meta,
    });

    fixture.detectChanges();

    const next = Array.from(element.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Next',
    )!;

    next.focus();
    next.click();

    fixture.detectChanges();

    expect(document.activeElement).toBe(element.querySelector('#results-heading'));
    http.expectOne('/api/v1/flashcards?page=1&size=20').flush({
      success: true,
      data: {
        flashcardItems: [{ id: 74, word: 'other' }],
        page: 1,
        size: 20,
        totalPages: 2,
        totalElements: 21,
      },
      meta,
    });

    fixture.detectChanges();
    expect(document.activeElement).toBe(element.querySelector('#results-heading'));
  });

  it.each([401, 403])(
    'preserves safe authorization feedback for list HTTP %s and a keyboard-safe retry',
    (status) => {
      http
        .expectOne('/api/v1/flashcards?page=0&size=20')
        .flush(null, { status, statusText: 'Denied' });
      fixture.detectChanges();
      expect(element.textContent).toContain(
        status === 401 ? 'Please sign in again' : 'You do not have permission',
      );
      Array.from(element.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'Try again')!
        .click();
      fixture.detectChanges();
      expect(document.activeElement).toBe(element.querySelector('#results-heading'));
      http.expectOne('/api/v1/flashcards?page=0&size=20').flush({
        success: true,
        data: { flashcardItems: [], page: 0, size: 20, totalPages: 0, totalElements: 0 },
        meta,
      });
      fixture.detectChanges();
    },
  );
});
