import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, startWith, Subject, switchMap } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { Flashcard } from '../../components/flashcard/flashcard';
import { Flashcard as FlashcardModel } from '../../models/flashcard.model';
import { FlashcardService } from '../../services/flashcard.service';

type DetailState =
  | { readonly status: 'loading' | 'missing' | 'error' }
  | { readonly status: 'loaded'; readonly card: FlashcardModel };

@Component({
  selector: 'app-flashcard-detail',
  imports: [RouterLink, Flashcard],
  templateUrl: './detail.html',
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

  retry(): void {
    this.reload.next();
  }
}
