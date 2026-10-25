import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { SessionSetup } from './session-setup';
import { learningSuccess, sessionFixture } from '../testing/learning.fixture';

describe('Session creation', () => {
  let http: HttpTestingController;
  let setup: SessionSetup;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SessionSetup],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ lessonId: '12' })) },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    setup = TestBed.createComponent(SessionSetup).componentInstance;
    http
      .expectOne('/api/v1/flashcards/sessions?status=IN_PROGRESS&page=0&size=20&lessonId=12')
      .flush(learningSuccess({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
    await Promise.resolve();
  });
  afterEach(() => http.verify());
  it('prevents duplicate creation and retains a returned ID if navigation fails', async () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(false);
    const first = setup.start();
    await setup.start();
    const req = http.expectOne('/api/v1/flashcards/sessions');
    expect(req.request.body.lessonId).toBe(12);
    req.flush(learningSuccess({ outcome: 'CREATED', eligibleCount: 1, session: sessionFixture }));
    await first;
    expect(setup.createdId()).toBe(9);
    await setup.start();
    http.expectNone('/api/v1/flashcards/sessions');
  });
  it('handles no eligible cards as normal and rejects invalid limits', async () => {
    setup.limit = 101;
    await setup.start();
    http.expectNone('/api/v1/flashcards/sessions');
    setup.limit = 20;
    const start = setup.start();
    http
      .expectOne('/api/v1/flashcards/sessions')
      .flush(learningSuccess({ outcome: 'NO_ELIGIBLE_CARDS', eligibleCount: 0 }));
    await start;
    expect(setup.message()).toContain('No eligible cards');
    expect(setup.uncertain()).toBe(false);
  });
  it('does not repeat an uncertain creation automatically', async () => {
    const start = setup.start();
    http.expectOne('/api/v1/flashcards/sessions').error(new ProgressEvent('error'));
    await start;
    expect(setup.uncertain()).toBe(true);
    await setup.start();
    http.expectNone('/api/v1/flashcards/sessions');
  });
});
