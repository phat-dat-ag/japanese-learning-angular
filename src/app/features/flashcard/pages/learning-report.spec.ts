import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { LearningReport } from './learning-report';
import { learningSuccess, statisticsFixture, unseenProgress } from '../testing/learning.fixture';

describe('Learning collections and statistics', () => {
  let http: HttpTestingController;
  const params = new BehaviorSubject(convertToParamMap({}));
  async function setup(kind: string) {
    params.next(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [LearningReport],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { data: of({ kind }), queryParamMap: params } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(LearningReport);
    fixture.detectChanges();
    http.expectOne('/api/v1/jlpt-levels').flush(learningSuccess([{ code: 'N5', name: 'JLPT N5' }]));
    return fixture;
  }
  afterEach(() => http.verify());
  it('shows studied practice coverage separately from mastery and filters using database IDs', async () => {
    const fixture = await setup('statistics');
    http.expectOne('/api/v1/flashcards/statistics?').flush(learningSuccess(statisticsFixture));
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Studied 50%');
    expect(element.textContent).toContain('Mastered 0%');
    expect(element.textContent).toContain('Practice attempts');
    params.next(convertToParamMap({ level: 'n5', lessonId: '12' }));
    http
      .expectOne('/api/v1/lessons?level=n5')
      .flush(learningSuccess([{ id: 12, lessonNumber: 1, title: 'Lesson one', description: '' }]));
    http
      .expectOne('/api/v1/flashcards/statistics?level=N5&lessonId=12')
      .flush(learningSuccess(statisticsFixture));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.querySelectorAll('select')[1].value).toBe('12');
  });
  it('renders bookmark state, removes through DELETE and reloads the collection', async () => {
    const fixture = await setup('bookmarks');
    const url = '/api/v1/flashcards/bookmarks?page=0&size=20';
    http.expectOne(url).flush(
      learningSuccess({
        items: [{ id: 7, word: 'word', progress: unseenProgress, bookmarked: true }],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      }),
    );
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      'app-bookmark-button button',
    );
    expect(button.getAttribute('aria-pressed')).toBe('true');
    const saving = fixture.componentInstance.bookmark(7, false);
    const remove = http.expectOne('/api/v1/flashcards/7/bookmark');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(learningSuccess({ vocabularyId: 7, bookmarked: false }));
    await saving;
    http
      .expectOne(url)
      .flush(learningSuccess({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No vocabulary in this collection');
  });
  it('switches queues, cancels old reads and rejects invalid pagination', async () => {
    const fixture = await setup('review');
    const due = http.expectOne('/api/v1/flashcards/reviews/due?page=0&size=20');
    params.next(convertToParamMap({ queue: 'forgotten' }));
    expect(due.cancelled).toBe(true);
    http
      .expectOne('/api/v1/flashcards/reviews/forgotten?page=0&size=20')
      .flush(learningSuccess({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ranked by AGAIN history');
    params.next(convertToParamMap({ page: '-1' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Invalid filters');
    http.expectNone((req) => req.url.includes('reviews'));
  });
});
