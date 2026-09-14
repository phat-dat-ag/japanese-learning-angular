import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LevelList } from './level-list';

const url = '/api/v1/jlpt-levels';
const meta = { timestamp: '2026-09-14T08:11:32Z', traceId: 'trace', correlationId: 'correlation' };
const levels = [
  { code: 'N5', name: 'JLPT N5' },
  { code: 'N4', name: 'JLPT N4' },
  { code: 'N3', name: 'JLPT N3' },
  { code: 'N2', name: 'JLPT N2' },
  { code: 'N1', name: 'JLPT N1' },
];

describe('LevelList API integration', () => {
  let fixture: ComponentFixture<LevelList>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LevelList],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LevelList);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('shows loading, then backend levels with lowercase lesson links and no fabricated counts', () => {
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Loading');
    expect(element.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
    http.expectOne(url).flush({ success: true, data: levels, meta });
    fixture.detectChanges();
    const links = [...element.querySelectorAll('app-level-card a')];
    expect(links).toHaveLength(5);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/flashcards/n5',
      '/flashcards/n4',
      '/flashcards/n3',
      '/flashcards/n2',
      '/flashcards/n1',
    ]);
    expect(links[0].textContent).toContain('JLPT N5');
    expect(links[0].textContent).not.toContain('lessons');
    expect(element.querySelector('section')?.getAttribute('aria-busy')).toBe('false');
  });

  it('shows a distinct empty state', () => {
    http.expectOne(url).flush({ success: true, data: [], meta });
    fixture.detectChanges();
    expect(element.textContent).toContain('No JLPT levels available.');
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows a safe error and successfully retries', () => {
    http.expectOne(url).flush(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'private diagnostic', details: [] },
        meta,
      },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Unable to load');
    expect(element.textContent).not.toContain('private diagnostic');
    element.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Loading');
    http.expectOne(url).flush({ success: true, data: levels, meta });
    fixture.detectChanges();
    expect(element.querySelectorAll('app-level-card')).toHaveLength(5);
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it.each(
    [
      [{ code: '', name: 'Missing code' }],
      [{ code: 'N5', name: '' }],
      [
        { code: 'N5', name: 'JLPT N5' },
        { code: 'N5', name: 'Duplicate' },
      ],
      [{ code: 'N5' }],
      { code: 'N5', name: 'Not an array' },
    ].map((data) => [data]),
  )('rejects invalid level payloads: %j', (data) => {
    http.expectOne(url).flush({ success: true, data, meta });
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
    expect(element.querySelector('app-level-card')).toBeNull();
  });

  it('keeps standard levels when the backend includes unsupported rows', () => {
    http.expectOne(url).flush({
      success: true,
      data: [
        { code: 'n6', name: 'n6666' },
        ...levels,
        { code: 'N6', name: 'Custom level' },
        { code: 'N6666', name: 'Another custom level' },
      ],
      meta,
    });
    fixture.detectChanges();
    const cards = [...element.querySelectorAll('app-level-card')];
    expect(cards).toHaveLength(5);
    expect(cards.map((card) => card.querySelector('h2')?.textContent?.trim())).toEqual(
      levels.map((level) => level.name),
    );
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.textContent).not.toContain('n6666');
  });

  it('shows an empty state when all backend levels are unsupported', () => {
    http.expectOne(url).flush({
      success: true,
      data: [{ code: 'n6', name: 'n6666' }],
      meta,
    });
    fixture.detectChanges();
    expect(element.textContent).toContain('No JLPT levels available.');
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });
  it('cancels the request when the page is destroyed', () => {
    const request = http.expectOne(url);
    fixture.destroy();
    expect(request.cancelled).toBe(true);
  });

  it('ignores an earlier request when reloading', () => {
    const previous = http.expectOne(url);
    fixture.componentInstance.retry();
    expect(previous.cancelled).toBe(true);
    http.expectOne(url).flush({ success: true, data: levels, meta });
    fixture.detectChanges();
    expect(element.querySelectorAll('app-level-card')).toHaveLength(5);
  });
});
