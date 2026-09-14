import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { LessonList } from './lesson-list';

const url = '/api/v1/lessons?level=n5';
const meta = { timestamp: '2026-09-14T09:51:32Z', traceId: 'trace', correlationId: 'correlation' };
const lesson = { id: 1, lessonNumber: 1, title: 'N5 ne ban oi', description: 'abc mo ta' };

describe('LessonList API integration', () => {
  let fixture: ComponentFixture<LessonList>;
  let http: HttpTestingController;
  let element: HTMLElement;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({ level: 'n5' }));
    await TestBed.configureTestingModule({
      imports: [LessonList],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LessonList);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('shows loading then backend content, actual count and numeric lesson links', () => {
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Loading');
    expect(element.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
    const request = http.expectOne(url);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Accept')).toBe('application/json');
    request.flush({ success: true, data: [lesson], meta });
    fixture.detectChanges();
    const card = element.querySelector('app-lesson-card');
    expect(card?.textContent).toContain('Lesson 1');
    expect(card?.textContent).toContain(lesson.title);
    expect(card?.textContent).toContain(lesson.description);
    expect(card?.querySelector('a')?.getAttribute('href')).toBe('/flashcards/n5/lessons/1');
    expect(card?.textContent).not.toContain('words');
    expect(element.textContent).toContain('1 lesson available.');
    expect(element.querySelector('section')?.getAttribute('aria-busy')).toBe('false');
  });

  it('shows an empty state without an error', () => {
    http.expectOne(url).flush({ success: true, data: [], meta });
    fixture.detectChanges();
    expect(element.textContent).toContain('No lessons available.');
    expect(element.textContent).toContain('0 lessons available.');
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows a safe error and retries successfully', () => {
    http
      .expectOne(url)
      .flush(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'private diagnostic', details: [] },
          meta,
        },
        { status: 500, statusText: 'Server Error' },
      );
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Unable to load lessons',
    );
    expect(element.textContent).not.toContain('private diagnostic');
    element.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Loading');
    http.expectOne(url).flush({ success: true, data: [lesson], meta });
    fixture.detectChanges();
    expect(element.querySelectorAll('app-lesson-card')).toHaveLength(1);
  });

  it.each([
    [[{ ...lesson, id: '1' }]],
    [[{ ...lesson, id: 0 }]],
    [[{ ...lesson, lessonNumber: 1.5 }]],
    [[{ ...lesson, title: '' }]],
    [[{ ...lesson, description: null }]],
    [[lesson, lesson]],
    [{ lesson }],
  ])('rejects malformed lesson payloads: %j', (data) => {
    http.expectOne(url).flush({ success: true, data, meta });
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
    expect(element.querySelector('app-lesson-card')).toBeNull();
  });

  it('cancels stale requests when route parameters change and normalizes the level', () => {
    const previous = http.expectOne(url);
    params.next(convertToParamMap({ level: 'N4' }));
    expect(previous.cancelled).toBe(true);
    http.expectOne('/api/v1/lessons?level=n4').flush({
      success: true,
      data: [{ ...lesson, id: 42, title: 'N4 lesson' }],
      meta,
    });
    fixture.detectChanges();
    expect(element.querySelector('h1')?.textContent).toContain('JLPT N4');
    expect(element.querySelector('app-lesson-card a')?.getAttribute('href')).toBe(
      '/flashcards/n4/lessons/42',
    );
  });

  it('clears old lessons when another level starts loading', () => {
    http.expectOne(url).flush({ success: true, data: [lesson], meta });
    fixture.detectChanges();
    params.next(convertToParamMap({ level: 'n3' }));
    fixture.detectChanges();
    expect(element.querySelector('app-lesson-card')).toBeNull();
    expect(element.textContent).toContain('Loading');
    http.expectOne('/api/v1/lessons?level=n3').flush({ success: true, data: [], meta });
  });

  it('does not request unsupported or missing levels', () => {
    http.expectOne(url).flush({ success: true, data: [], meta });
    for (const level of ['n6', 'invalid', '']) {
      params.next(convertToParamMap({ level }));
      fixture.detectChanges();
      expect(element.querySelector('[role="alert"]')?.textContent).toContain('Invalid JLPT level');
      http.expectNone((request) => request.url.startsWith('/api/v1/lessons'));
    }
  });

  it('cancels the request when the page is destroyed', () => {
    const request = http.expectOne(url);
    fixture.destroy();
    expect(request.cancelled).toBe(true);
  });
});
