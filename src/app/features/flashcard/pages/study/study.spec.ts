import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { Study } from './study';

const url = '/api/v1/lessons?level=n5';
const meta = { timestamp: '2026-09-14T09:51:32Z', traceId: 'trace', correlationId: 'correlation' };
const lesson = {
  id: 1,
  lessonNumber: 1,
  title: 'Backend lesson',
  description: 'Backend description',
};

describe('Study lesson metadata', () => {
  let fixture: ComponentFixture<Study>;
  let http: HttpTestingController;
  let element: HTMLElement;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({ level: 'n5', lessonId: '1' }));
    await TestBed.configureTestingModule({
      imports: [Study],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Study);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('uses backend metadata and shows an empty state without fake flashcards or progress', () => {
    expect(element.textContent).toContain('Loading lesson');
    http.expectOne(url).flush({ success: true, data: [lesson], meta });
    fixture.detectChanges();
    expect(element.querySelector('h1')?.textContent).toBe(lesson.title);
    expect(element.textContent).toContain(lesson.description);
    expect(element.textContent).toContain('N5 / Lesson 1');
    expect(element.textContent).toContain('No flashcards available');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/flashcards/n5');
    expect(element.textContent).not.toContain('1 / 0');
    expect(element.querySelector('app-flashcard')).toBeNull();
  });

  it('handles lessons absent from the backend', () => {
    http.expectOne(url).flush({ success: true, data: [], meta });
    fixture.detectChanges();
    expect(element.textContent).toContain('Lesson not found');
  });

  it('handles failures and retries', () => {
    http.expectOne(url).flush('private diagnostic', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(element.textContent).toContain('Unable to load lesson');
    expect(element.textContent).not.toContain('private diagnostic');
    element.querySelector<HTMLButtonElement>('button')!.click();
    http.expectOne(url).flush({ success: true, data: [lesson], meta });
    fixture.detectChanges();
    expect(element.querySelector('h1')?.textContent).toBe(lesson.title);
  });

  it('cancels stale requests and updates on navigation to another lesson', () => {
    const previous = http.expectOne(url);
    params.next(convertToParamMap({ level: 'n4', lessonId: '2' }));
    expect(previous.cancelled).toBe(true);
    http.expectOne('/api/v1/lessons?level=n4').flush({
      success: true,
      data: [{ ...lesson, id: 2, title: 'Second lesson' }],
      meta,
    });
    fixture.detectChanges();
    expect(element.querySelector('h1')?.textContent).toBe('Second lesson');
  });

  it('rejects invalid route parameters without fetching', () => {
    const previous = http.expectOne(url);
    params.next(convertToParamMap({ level: 'n5', lessonId: 'old-mock-id' }));
    expect(previous.cancelled).toBe(true);
    fixture.detectChanges();
    expect(element.textContent).toContain('Lesson not found');
    http.expectNone(url);
  });
});
