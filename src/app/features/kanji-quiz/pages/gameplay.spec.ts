import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { QuizNextQuestion, QuizSession } from '../models/quiz-gameplay.model';
import {
  answer,
  completion,
  nextQuestion,
  question,
  session,
} from '../testing/quiz-gameplay.fixture';
import { meta, success } from '../testing/quiz-player.fixture';
import { Gameplay } from './gameplay';

describe('Gameplay', () => {
  let fixture: ComponentFixture<Gameplay>;
  let page: Gameplay;
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const base = '/api/v1/kanji-quiz/sessions/';
  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ sessionId: '42' }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Gameplay);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });
  function restore(summary: QuizSession = session, next: QuizNextQuestion = nextQuestion): void {
    http.expectOne(base + summary.sessionId).flush(success(summary));
    if (summary.status === 'IN_PROGRESS') {
      http.expectOne(base + summary.sessionId + '/next').flush(success(next));
    }
    fixture.detectChanges();
  }
  function button(text: string): HTMLButtonElement {
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const result = buttons.find((entry) => entry.textContent?.includes(text));
    if (!result) throw new Error('Missing button: ' + text);
    return result;
  }
  function fail(path: string, status = 500, code = 'INTERNAL_ERROR'): void {
    http.expectOne(base + '42' + path).flush(
      {
        success: false,
        error: { code, message: 'Private backend diagnostic', details: [] },
        meta,
      },
      { status, statusText: 'Failure' },
    );
    fixture.detectChanges();
  }
  function readyToFinish(): void {
    restore({ ...session, answeredCount: 2, score: 1 }, { ...nextQuestion, question: null });
  }

  it('restores a direct session URL with its next unanswered snapshot', () => {
    expect(fixture.nativeElement.textContent).toContain('Loading session');
    restore(
      { ...session, answeredCount: 1 },
      {
        ...nextQuestion,
        question: { ...question, sessionQuestionId: 102, questionNumber: 1 },
      },
    );
    expect(page.questionState()?.question.sessionQuestionId).toBe(102);
    expect(page.questionState()?.selectedOptionId).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('input[type=radio]')).toHaveLength(4);
    expect(button('Submit answer').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('Correct answer');
    expect(fixture.nativeElement.textContent).not.toContain('School');
  });

  it.each([
    ['😀がっこうへ', 1, 4, '😀', 'がっこう', 'へ'],
    ['あ𠮷い', 1, 1, 'あ', '𠮷', 'い'],
    ['がっこう', 0, 4, '', 'がっこう', ''],
    ['か\u3099く', 0, 2, '', 'か\u3099', 'く'],
  ])(
    'highlights Unicode code points in %s',
    (sentenceReading, targetStart, targetLength, before, target, after) => {
      restore(session, {
        ...nextQuestion,
        question: { ...question, sentenceReading, targetStart, targetLength },
      });
      expect(page.sentence()).toEqual({ before, target, after });
      expect(fixture.nativeElement.querySelector('mark').textContent).toBe(target);
      expect(fixture.nativeElement.querySelector('p[lang=ja]').textContent).toBe(sentenceReading);
    },
  );

  it('selects one option via native radios and submits exactly the snapshot IDs', () => {
    restore();
    const radios: HTMLInputElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('input[type=radio]'),
    );
    radios[1].click();
    fixture.detectChanges();
    expect(radios[1].checked).toBe(true);
    expect(radios.filter((radio) => radio.checked)).toHaveLength(1);
    button('Submit answer').click();
    page.submitAnswer();
    page.nextQuestion();
    page.selectOption(403);
    fixture.detectChanges();
    expect(button('Submitting').disabled).toBe(true);
    const pending = http.expectOne(base + '42/answers');
    expect(pending.request.body).toEqual({ sessionQuestionId: 101, selectedOptionId: 402 });
    pending.flush(success(answer));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Incorrect.');
    expect(fixture.nativeElement.textContent).toContain('Correct answer');
    expect(fixture.nativeElement.textContent).toContain('School');
    expect(fixture.nativeElement.textContent).toContain('Trường học');
    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(true);
    page.submitAnswer();
    http.expectNone(base + '42/answers');
    http.expectNone(base + '42/next');
  });

  it('uses backend correctness rather than guessing from the option text', () => {
    restore();
    page.selectOption(402);
    page.submitAnswer();
    http.expectOne(base + '42/answers').flush(
      success({
        ...answer,
        correct: true,
        correctOptionId: 402,
        explanationEn: null,
        explanationVi: null,
      }),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Correct!');
    expect(fixture.nativeElement.textContent).not.toContain('Incorrect.');
  });

  it('does not skip an unanswered question or allow an unknown option', () => {
    restore();
    page.selectOption(999);
    page.submitAnswer();
    page.nextQuestion();
    page.finishGame();
    http.expectNone((request) => request.url.startsWith(base));
    expect(page.questionState()?.selectedOptionId).toBeNull();
  });

  it('loads the next question once and clears prior feedback and selection', () => {
    restore();
    page.selectOption(402);
    page.submitAnswer();
    http.expectOne(base + '42/answers').flush(success(answer));
    page.nextQuestion();
    page.nextQuestion();
    page.submitAnswer();
    restore(
      { ...session, answeredCount: 1 },
      {
        ...nextQuestion,
        question: { ...question, sessionQuestionId: 102, questionNumber: 1 },
      },
    );
    expect(page.questionState()?.question.sessionQuestionId).toBe(102);
    expect(page.questionState()?.feedback).toBeNull();
    expect(page.questionState()?.selectedOptionId).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('School');
  });

  it('restores correctly after the component is recreated on refresh', () => {
    restore();
    fixture.destroy();
    fixture = TestBed.createComponent(Gameplay);
    page = fixture.componentInstance;
    restore(
      { ...session, answeredCount: 1 },
      {
        ...nextQuestion,
        question: { ...question, sessionQuestionId: 102, questionNumber: 1 },
      },
    );
    expect(page.questionState()?.question.sessionQuestionId).toBe(102);
  });

  it('shows a completed session without fetching or submitting questions', () => {
    restore({ ...session, status: 'COMPLETED', answeredCount: 2 });
    expect(fixture.nativeElement.textContent).toContain('Game completed!');
    page.submitAnswer();
    page.finishGame();
    http.expectNone(base + '42/next');
    http.expectNone(base + '42/finish');
  });

  it('shows an abandoned session as read-only', () => {
    restore({ ...session, status: 'ABANDONED' });
    expect(fixture.nativeElement.textContent).toContain('cannot accept answers');
    expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(0);
  });

  it('distinguishes empty snapshots from a game ready to finish', () => {
    restore(session, { ...nextQuestion, question: null });
    expect(fixture.nativeElement.textContent).toContain('No question is available');
    page.finishGame();
    http.expectNone(base + '42/finish');
    button('Retry').click();
    restore();
  });

  it('requires confirmation before finish and blocks rapid duplicate finishes', () => {
    readyToFinish();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    button('Finish Game').click();
    http.expectNone(base + '42/finish');
    confirm.mockReturnValue(true);
    button('Finish Game').click();
    page.finishGame();
    page.retry();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Finishing game');
    const pending = http.expectOne(base + '42/finish');
    expect(pending.request.body).toBeNull();
    pending.flush(success(completion));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Game completed!');
    page.finishGame();
    http.expectNone(base + '42/finish');
  });

  it('lets the final answer show feedback before continuing to finish', () => {
    restore({ ...session, answeredCount: 1 });
    page.selectOption(401);
    page.submitAnswer();
    http.expectOne(base + '42/answers').flush(
      success({
        ...answer,
        correct: true,
        answeredCount: 2,
        remainingCount: 0,
      }),
    );
    fixture.detectChanges();
    expect(button('Continue to finish')).toBeDefined();
    http.expectNone(base + '42/finish');
    button('Continue to finish').click();
    readyToFinish();
    expect(button('Finish Game')).toBeDefined();
  });

  it.each(['', '/next'])('retries a failed read at %s', (path) => {
    if (path) http.expectOne(base + '42').flush(success(session));
    fail(path);
    expect(fixture.nativeElement.textContent).not.toContain('Private backend diagnostic');
    button('Retry').click();
    page.retry();
    restore();
  });

  it.each([400, 409, 500])(
    'reloads server state after answer HTTP %s instead of blindly retrying the POST',
    (status) => {
      restore();
      page.selectOption(402);
      page.submitAnswer();
      fail('/answers', status);
      page.submitAnswer();
      http.expectNone(base + '42/answers');
      button('Retry').click();
      restore();
      page.selectOption(401);
      page.submitAnswer();
      http.expectOne(base + '42/answers').flush(success(answer));
    },
  );

  it('recovers a lost answer response by loading the server next question', () => {
    restore();
    page.selectOption(402);
    page.submitAnswer();
    http.expectOne(base + '42/answers').error(new ProgressEvent('error'));
    fixture.detectChanges();
    button('Retry').click();
    restore(
      { ...session, answeredCount: 1 },
      {
        ...nextQuestion,
        question: { ...question, sessionQuestionId: 102, questionNumber: 1 },
      },
    );
    expect(page.questionState()?.question.sessionQuestionId).toBe(102);
    http.expectNone(base + '42/answers');
  });

  it.each([409, 500])(
    'reloads after finish HTTP %s and recognizes an already committed completion',
    (status) => {
      readyToFinish();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      page.finishGame();
      fail('/finish', status);
      page.finishGame();
      http.expectNone(base + '42/finish');
      button('Retry').click();
      restore({ ...session, status: 'COMPLETED', answeredCount: 2 });
      expect(fixture.nativeElement.textContent).toContain('Game completed!');
    },
  );

  it.each([401, 403, 404])('handles unavailable session HTTP %s safely', (status) => {
    fail('', status);
    expect(page.state().status).toBe('error');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Private backend diagnostic');
  });

  it('rejects a session status change between the summary and next read', () => {
    restore(session, { ...nextQuestion, status: 'COMPLETED', question: null });
    expect(fixture.nativeElement.textContent).toContain('session has changed');
    button('Retry').click();
    restore({ ...session, status: 'COMPLETED', answeredCount: 2 });
  });

  it.each(['session', 'next', 'answer', 'finish'])(
    'cancels stale %s responses when the route session changes',
    (operation) => {
      let pending;
      if (operation === 'session') {
        pending = http.expectOne(base + '42');
      } else if (operation === 'next') {
        http.expectOne(base + '42').flush(success(session));
        pending = http.expectOne(base + '42/next');
      } else if (operation === 'answer') {
        restore();
        page.selectOption(402);
        page.submitAnswer();
        pending = http.expectOne(base + '42/answers');
      } else {
        readyToFinish();
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        page.finishGame();
        pending = http.expectOne(base + '42/finish');
      }
      params.next(convertToParamMap({ sessionId: '73' }));
      expect(pending.cancelled).toBe(true);
      restore({ ...session, sessionId: 73 }, { ...nextQuestion, sessionId: 73 });
      expect(page.sessionId()).toBe(73);
      expect(page.questionState()?.feedback).toBeNull();
      expect(page.state().status).toBe('question');
    },
  );

  it('cancels requests when destroyed', () => {
    const pending = http.expectOne(base + '42');
    fixture.destroy();
    expect(pending.cancelled).toBe(true);
  });
});
