import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FlashcardDashboard } from './dashboard';
import { learningSuccess, sessionFixture, statisticsFixture } from '../testing/learning.fixture';

describe('Personal flashcard dashboard', () => {
  it('loads independent progress and resume links while preserving level browsing', async () => {
    await TestBed.configureTestingModule({
      imports: [FlashcardDashboard],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(FlashcardDashboard);
    fixture.detectChanges();
    http.expectOne('/api/v1/flashcards/statistics?').flush(learningSuccess(statisticsFixture));
    const { items, ...session } = sessionFixture;
    http
      .expectOne('/api/v1/flashcards/sessions?status=IN_PROGRESS&page=0&size=20')
      .flush(
        learningSuccess({ items: [session], page: 0, size: 20, totalElements: 1, totalPages: 1 }),
      );
    http.expectOne('/api/v1/jlpt-levels').flush(learningSuccess([{ code: 'N5', name: 'JLPT N5' }]));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/flashcards/sessions/9"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/flashcards/n5"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Studied 50%');
    http.verify();
  });
});
