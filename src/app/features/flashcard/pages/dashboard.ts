import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, map, switchMap } from 'rxjs';
import { LevelList } from './level-list/level-list';
import { LearningNav } from '../components/learning-nav';
import { ProgressSummary } from '../components/progress-summary';
import { learningView } from '../models/learning-view-state';
import { FlashcardLearningService } from '../services/flashcard-learning.service';
import { FlashcardSessionService } from '../services/flashcard-session.service';

@Component({
  selector: 'app-flashcard-dashboard',
  imports: [RouterLink, DatePipe, LevelList, LearningNav, ProgressSummary],
  host: { '(window:focus)': 'refresh()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="mx-auto max-w-6xl px-6 pt-8">
      <app-learning-nav />
      <h1 class="mb-5 text-3xl font-bold text-gray-900">Your learning progress</h1>
      @let overview = statistics();
      @if (overview.status === 'loaded') {
        <app-progress-summary [statistics]="overview.data" />
      } @else if (overview.status === 'error') {
        <p role="alert">{{ overview.message }}</p>
      } @else {
        <p role="status">Loading progress…</p>
      }
      <button type="button" (click)="refresh()" class="my-3 rounded border px-3 py-2 text-sm">
        Refresh progress and sessions
      </button>
      <h2 class="mt-3 text-lg font-semibold">Continue learning</h2>
      @let active = sessions();
      @if (active.status === 'loaded') {
        <ul class="mt-3 grid gap-3 sm:grid-cols-2">
          @for (session of active.data.items; track session.sessionId) {
            <li>
              <a
                [routerLink]="['/flashcards/sessions', session.sessionId]"
                class="block rounded-xl border border-gray-200 bg-white p-4 text-indigo-700 focus-visible:outline-2"
              >
                {{ session.mode === 'ALL' ? 'Practice' : 'Scheduled learning' }} ·
                {{ session.completedCount }}/{{ session.itemCount }} completed
                <span class="mt-1 block text-sm text-gray-500"
                  >Started {{ session.createdAt | date: 'medium' }}</span
                >
              </a>
            </li>
          } @empty {
            <li class="text-gray-500">No unfinished sessions. Choose a lesson below.</li>
          }
        </ul>
        @if (active.data.totalPages > 1) {
          <nav aria-label="Session pages" class="mt-3 flex gap-3">
            <button
              (click)="page.next(active.data.page - 1)"
              [disabled]="active.data.page === 0"
              class="rounded border px-3 py-2"
            >
              Previous
            </button>
            <span>Page {{ active.data.page + 1 }} of {{ active.data.totalPages }}</span>
            <button
              (click)="page.next(active.data.page + 1)"
              [disabled]="active.data.page + 1 >= active.data.totalPages"
              class="rounded border px-3 py-2"
            >
              Next
            </button>
          </nav>
        }
      } @else if (active.status === 'error') {
        <p role="alert">{{ active.message }}</p>
      } @else {
        <p role="status">Loading sessions…</p>
      }
    </div>
    <app-level-list />`,
})
export class FlashcardDashboard {
  private readonly learning = inject(FlashcardLearningService);
  private readonly api = inject(FlashcardSessionService);
  readonly page = new BehaviorSubject(0);
  private readonly reload = new BehaviorSubject(0);
  readonly statistics = toSignal(
    this.reload.pipe(
      switchMap(() => learningView(this.learning.statistics().pipe(map((r) => r.data)))),
    ),
    { requireSync: true },
  );
  readonly sessions = toSignal(
    this.page.pipe(
      switchMap((page) =>
        learningView(this.api.list(undefined, 'IN_PROGRESS', page).pipe(map((r) => r.data))),
      ),
    ),
    { requireSync: true },
  );
  refresh(): void {
    this.reload.next(this.reload.value + 1);
    this.page.next(this.page.value);
  }
}
