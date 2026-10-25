import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, map, of, startWith, Subject, switchMap } from 'rxjs';
import { LearningNav } from '../components/learning-nav';
import { ProgressSummary } from '../components/progress-summary';
import { BookmarkButton } from '../components/bookmark-button';
import { learningView } from '../models/learning-view-state';
import { LearningScope } from '../models/learning.model';
import {
  FlashcardLearningService,
  LearningCollection,
} from '../services/flashcard-learning.service';
import { LessonService } from '../services/lesson.service';
import { JlptLevelService } from '../services/jlpt-level.service';
import { BookmarkState } from '../services/bookmark-state';

@Component({
  selector: 'app-learning-report',
  imports: [FormsModule, RouterLink, DatePipe, LearningNav, ProgressSummary, BookmarkButton],
  providers: [BookmarkState],
  host: { '(window:focus)': 'refresh()' },
  templateUrl: './learning-report.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LearningReport {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(FlashcardLearningService);
  private readonly lessonApi = inject(LessonService);
  private readonly levelApi = inject(JlptLevelService);
  private readonly reload = new Subject<void>();
  private readonly filterReload = new Subject<void>();
  readonly bookmarks = inject(BookmarkState);
  private readonly selection$ = combineLatest([this.route.data, this.route.queryParamMap]).pipe(
    map(([data, params]) => {
      const kind = data['kind'] as 'statistics' | 'bookmarks' | 'review';
      const level = params.get('level')?.toUpperCase() || undefined;
      const lessonRaw = params.get('lessonId');
      const lessonId = lessonRaw === null ? undefined : Number(lessonRaw);
      const pageRaw = params.get('page') ?? '0';
      const page = Number(pageRaw);
      const queue = params.get('queue') ?? 'due';
      const valid =
        (!level || /^N[1-5]$/.test(level)) &&
        (lessonId === undefined ||
          (/^[1-9]\d*$/.test(lessonRaw!) && Number.isSafeInteger(lessonId))) &&
        /^\d+$/.test(pageRaw) &&
        Number.isSafeInteger(page) &&
        page <= Math.floor(2147483647 / 20) &&
        ['due', 'forgotten'].includes(queue);
      const scope: LearningScope = { level, lessonId };
      const collection: LearningCollection =
        kind === 'bookmarks'
          ? 'bookmarks'
          : queue === 'forgotten'
            ? 'reviews/forgotten'
            : 'reviews/due';
      return { kind, scope, page, queue, valid, collection };
    }),
  );
  readonly selection = toSignal(this.selection$, { requireSync: true });
  readonly levels = toSignal(
    this.filterReload.pipe(
      startWith(undefined),
      switchMap(() => learningView(this.levelApi.getLevels())),
    ),
    { requireSync: true },
  );
  readonly lessons = toSignal(
    combineLatest([this.selection$, this.filterReload.pipe(startWith(undefined))]).pipe(
      switchMap(([s]) =>
        s.valid && s.scope.level
          ? learningView(this.lessonApi.getLessons(s.scope.level).pipe(map((r) => r.data)))
          : learningView(of([])),
      ),
    ),
    { requireSync: true },
  );
  readonly statistics = toSignal(
    combineLatest([this.selection$, this.reload.pipe(startWith(undefined))]).pipe(
      switchMap(([s]) =>
        s.valid && s.kind === 'statistics'
          ? learningView(this.api.statistics(s.scope).pipe(map((r) => r.data)))
          : of(null),
      ),
    ),
    { requireSync: true },
  );
  readonly collection = toSignal(
    combineLatest([this.selection$, this.reload.pipe(startWith(undefined))]).pipe(
      switchMap(([s]) =>
        s.valid && s.kind !== 'statistics'
          ? learningView(
            this.api.collection(s.collection, s.scope, s.page).pipe(map((r) => r.data)),
          )
          : of(null),
      ),
    ),
    { requireSync: true },
  );
  refresh(): void {
    this.bookmarks.values.set(new Map());
    this.filterReload.next();
    this.reload.next();
  }
  filter(level: string, lessonId?: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { level: level || null, lessonId: lessonId || null, page: null },
      queryParamsHandling: 'merge',
    });
  }
  queue(value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { queue: value, page: null },
      queryParamsHandling: 'merge',
    });
  }
  page(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: value },
      queryParamsHandling: 'merge',
    });
  }
  async bookmark(id: number, value: boolean): Promise<void> {
    if (await this.bookmarks.save(id, value)) {
      const current = this.collection();
      if (
        this.selection().kind === 'bookmarks' &&
        !value &&
        current?.status === 'loaded' &&
        current.data.items.length === 1 &&
        current.data.page > 0
      )
        this.page(current.data.page - 1);
      else this.reload.next();
    }
  }
}
