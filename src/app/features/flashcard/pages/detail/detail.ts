import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, startWith, Subject, switchMap } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { Flashcard } from '../../components/flashcard/flashcard';
import { Flashcard as FlashcardModel } from '../../models/flashcard.model';
import { FlashcardService } from '../../services/flashcard.service';

type NavigationState =
  | { readonly status: 'unavailable' | 'loading' | 'error' }
  | { readonly status: 'loaded'; readonly ids: readonly number[] };

type DetailState =
  | { readonly status: 'loading' | 'missing' | 'error' }
  | { readonly status: 'loaded'; readonly card: FlashcardModel };

@Component({
  selector: 'app-flashcard-detail',
  imports: [RouterLink, Flashcard],
  templateUrl: './detail.html',
  styleUrl: './detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlashcardDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(FlashcardService);
  private readonly reload = new Subject<void>();

  readonly state = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const rawId = params.get('flashcardId') ?? '';
        const id = Number(rawId);
        if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id <= 0) {
          return of<DetailState>({ status: 'missing' });
        }
        return this.reload.pipe(
          startWith(undefined),
          switchMap(() =>
            this.service.getFlashcard(id).pipe(
              map((response): DetailState => ({ status: 'loaded', card: response.data })),
              catchError((error: unknown) =>
                of<DetailState>({
                  status: error instanceof ApiError && error.status === 404 ? 'missing' : 'error',
                }),
              ),
              startWith<DetailState>({ status: 'loading' }),
            ),
          ),
        );
      }),
    ),
    { initialValue: { status: 'loading' } as DetailState },
  );

  private readonly router = inject(Router);
  private readonly navigationReload = new Subject<void>();
  readonly direction = signal<'next' | 'previous'>('next');
  readonly moving = signal(false);
  readonly navigationFailed = signal(false);
  private readonly currentId = toSignal(
    this.route.paramMap.pipe(map((params) => Number(params.get('flashcardId')))),
  );
  readonly navigationState = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => ({
        lessonId: Number(params.get('lesson')),
        level: (params.get('level') ?? '').toLowerCase(),
      })),
      distinctUntilChanged(
        (previous, current) =>
          previous.lessonId === current.lessonId && previous.level === current.level,
      ),
      switchMap(({ lessonId, level }) => {
        if (!Number.isSafeInteger(lessonId) || lessonId <= 0 || !/^n[1-5]$/.test(level)) {
          return of<NavigationState>({ status: 'unavailable' });
        }
        return this.navigationReload.pipe(
          startWith(undefined),
          switchMap(() =>
            this.service.getLessonFlashcardIds(lessonId, level).pipe(
              map((ids): NavigationState => ({ status: 'loaded', ids })),
              catchError(() => of<NavigationState>({ status: 'error' })),
              startWith<NavigationState>({ status: 'loading' }),
            ),
          ),
        );
      }),
    ),
    { initialValue: { status: 'unavailable' } as NavigationState },
  );
  readonly navigation = computed(() => {
    const state = this.navigationState();
    if (state.status !== 'loaded' || state.ids.length < 2) return null;
    const index = state.ids.indexOf(this.currentId() ?? 0);
    if (index < 0) return null;
    return {
      index,
      total: state.ids.length,
      previousId: state.ids[(index - 1 + state.ids.length) % state.ids.length]!,
      nextId: state.ids[(index + 1) % state.ids.length]!,
    };
  });

  async move(direction: 'next' | 'previous'): Promise<void> {
    const navigation = this.navigation();
    if (!navigation || this.moving() || this.state().status === 'loading') return;
    this.direction.set(direction);
    this.moving.set(true);
    this.navigationFailed.set(false);
    try {
      const moved = await this.router.navigate(
        ['/flashcards', 'detail', direction === 'next' ? navigation.nextId : navigation.previousId],
        { queryParamsHandling: 'preserve' },
      );
      this.navigationFailed.set(!moved);
    } catch {
      this.navigationFailed.set(true);
    } finally {
      this.moving.set(false);
    }
  }

  retryNavigation(): void {
    this.navigationReload.next();
  }

  retry(): void {
    this.reload.next();
  }
}
