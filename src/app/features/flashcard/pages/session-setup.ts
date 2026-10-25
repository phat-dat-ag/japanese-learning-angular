import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthSession } from '../../../core/auth/auth-session.service';
import { LearningNav } from '../components/learning-nav';
import { SessionMode, SessionSummary } from '../models/learning.model';
import { learningError, uncertainWrite } from '../models/learning-error';
import { FlashcardSessionService } from '../services/flashcard-session.service';

@Component({
  selector: 'app-session-setup',
  imports: [FormsModule, RouterLink, LearningNav],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="mx-auto max-w-3xl px-6 py-8">
    <app-learning-nav />
    <h1 class="text-xl font-bold">Start a lesson session</h1>
    @if (invalid()) {
      <p role="alert">Invalid lesson. Choose a lesson from the dashboard.</p>
    } @else {
      <p class="my-3 text-sm text-gray-600">
        Continue an unfinished session below, or start another. Practice does not change your SRS
        schedule.
      </p>
      <form
        (ngSubmit)="start()"
        class="space-y-4 rounded-xl border border-gray-200 bg-white p-5"
        [attr.aria-busy]="busy()"
      >
        <div>
          <label for="session-mode" class="block">Mode</label
          ><select
            id="session-mode"
            name="mode"
            [(ngModel)]="mode"
            class="mt-1 block w-full rounded border p-2"
          >
            <option value="NEW_AND_DUE">Learn new and due</option>
            <option value="DUE">Review due</option>
            <option value="ALL">Practice all</option>
          </select>
        </div>
        <label class="block"
          >Card limit (1–100)<input
            name="limit"
            type="number"
            min="1"
            max="100"
            required
            [(ngModel)]="limit"
            class="mt-1 block w-full rounded border p-2"
        /></label>
        <label class="block"
          ><input name="shuffle" type="checkbox" [(ngModel)]="shuffle" /> Shuffle cards</label
        >
        <button
          type="submit"
          [disabled]="busy() || uncertain() || !validLimit()"
          class="rounded-lg bg-indigo-600 px-5 py-2 text-white disabled:opacity-50"
        >
          Start session
        </button>
      </form>
      @if (message()) {
        <p role="status" class="my-4">{{ message() }}</p>
      }
      @if (createdId(); as id) {
        <a [routerLink]="['/flashcards/sessions', id]" class="my-3 block text-indigo-700 underline"
          >Open saved session</a
        >
      }
      @if (uncertain()) {
        <p class="my-3">
          Creation may have succeeded. Check your sessions before starting another.
        </p>
        <button
          type="button"
          (click)="loadSessions()"
          [disabled]="busy()"
          class="rounded border px-4 py-2"
        >
          Check saved sessions
        </button>
        <button
          type="button"
          (click)="uncertain.set(false)"
          [disabled]="busy()"
          class="ml-3 rounded border px-4 py-2"
        >
          I checked; allow a new session
        </button>
      }
      <h2 class="mt-6 font-semibold">Unfinished sessions</h2>
      @if (sessionsError()) {
        <p role="alert">{{ sessionsError() }}</p>
        <button (click)="loadSessions()" class="my-2 rounded border px-3 py-2">
          Retry session list
        </button>
      }
      <ul class="mt-3 space-y-3">
        @for (session of sessions(); track session.sessionId) {
          <li>
            <a
              [routerLink]="['/flashcards/sessions', session.sessionId]"
              class="text-indigo-700 underline"
              >Continue {{ session.mode }} · {{ session.completedCount }}/{{ session.itemCount }}</a
            >
          </li>
        } @empty {
          <li class="text-gray-500">No unfinished sessions loaded.</li>
        }
      </ul>
      @if (hasMore()) {
        <button
          (click)="loadSessions(true)"
          [disabled]="busy()"
          class="mt-3 rounded border px-3 py-2"
        >
          More sessions
        </button>
      }
    }
  </div>`,
})
export class SessionSetup implements OnDestroy {
  private readonly api = inject(FlashcardSessionService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthSession);
  private generation = 0;
  private lessonId = 0;
  private page = 0;
  mode: SessionMode = 'NEW_AND_DUE';
  limit = 20;
  shuffle = false;
  readonly busy = signal(false);
  readonly invalid = signal(false);
  readonly uncertain = signal(false);
  readonly message = signal('');
  readonly sessionsError = signal('');
  readonly createdId = signal<number | null>(null);
  readonly sessions = signal<readonly SessionSummary[]>([]);
  readonly hasMore = signal(false);
  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        this.generation++;
        const raw = params.get('lessonId') ?? '';
        this.lessonId = Number(raw);
        this.invalid.set(!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(this.lessonId));
        this.message.set('');
        this.uncertain.set(false);
        this.createdId.set(null);
        this.busy.set(false);
        this.sessions.set([]);
        if (!this.invalid()) void this.loadSessions();
      });
  }
  ngOnDestroy(): void {
    this.generation++;
  }
  validLimit(): boolean {
    return Number.isInteger(this.limit) && this.limit >= 1 && this.limit <= 100;
  }
  async loadSessions(more = false): Promise<void> {
    if (this.busy()) return;
    const generation = this.generation,
      revision = this.auth.revision;
    const page = more ? this.page + 1 : 0;
    this.busy.set(true);
    this.sessionsError.set('');
    try {
      const { data } = await firstValueFrom(this.api.list(this.lessonId, 'IN_PROGRESS', page));
      if (generation !== this.generation || revision !== this.auth.revision) return;
      this.page = page;
      this.sessions.update((old) => (more ? [...old, ...data.items] : data.items));
      this.hasMore.set(page + 1 < data.totalPages);
    } catch (error) {
      if (generation === this.generation && revision === this.auth.revision)
        this.sessionsError.set(learningError(error));
    } finally {
      if (generation === this.generation && revision === this.auth.revision) this.busy.set(false);
    }
  }
  async start(): Promise<void> {
    if (this.busy() || this.invalid() || this.uncertain() || !this.validLimit()) return;
    const generation = this.generation,
      revision = this.auth.revision;
    this.busy.set(true);
    this.message.set('');
    try {
      const { data } = await firstValueFrom(
        this.api.create({
          lessonId: this.lessonId,
          mode: this.mode,
          cardLimit: this.limit,
          shuffle: this.shuffle,
        }),
      );
      if (generation !== this.generation || revision !== this.auth.revision) return;
      if (data.outcome === 'NO_ELIGIBLE_CARDS')
        this.message.set(
          'No eligible cards. Try practice, choose another lesson, or return when reviews are due.',
        );
      else {
        this.createdId.set(data.session.sessionId);
        this.uncertain.set(true);
        this.busy.set(false);
        await this.router.navigate(['/flashcards/sessions', data.session.sessionId]);
      }
    } catch (error) {
      if (generation === this.generation && revision === this.auth.revision) {
        this.uncertain.set(uncertainWrite(error) || this.createdId() !== null);
        this.message.set(learningError(error));
      }
    } finally {
      if (generation === this.generation && revision === this.auth.revision) this.busy.set(false);
    }
  }
}
