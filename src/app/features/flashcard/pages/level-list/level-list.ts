import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, Subject, switchMap } from 'rxjs';

import { LevelCard } from '../../components/level-card/level-card';
import { JlptLevel } from '../../models/jlpt-level.model';
import { JlptLevelService } from '../../services/jlpt-level.service';

type LevelListState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly levels: readonly JlptLevel[] }
  | { readonly status: 'error' };

@Component({
  selector: 'app-level-list',
  imports: [LevelCard],
  templateUrl: './level-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LevelList {
  private readonly levelService = inject(JlptLevelService);
  private readonly reload = new Subject<void>();

  // switchMap cancels stale requests; toSignal unsubscribes when the page is destroyed.
  readonly state = toSignal(
    this.reload.pipe(
      startWith(undefined),
      switchMap(() =>
        this.levelService.getLevels().pipe(
          map((levels): LevelListState => ({ status: 'loaded', levels })),
          catchError(() => of<LevelListState>({ status: 'error' })),
          startWith<LevelListState>({ status: 'loading' }),
        ),
      ),
    ),
    { requireSync: true },
  );

  retry(): void {
    this.reload.next();
  }
}
