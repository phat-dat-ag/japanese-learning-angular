import { Observable, catchError, map, of, startWith } from 'rxjs';
import { learningError } from './learning-error';

export type LearningViewState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly data: T }
  | { readonly status: 'error'; readonly message: string };

export function learningView<T>(source: Observable<T>): Observable<LearningViewState<T>> {
  return source.pipe(
    map((data): LearningViewState<T> => ({ status: 'loaded', data })),
    catchError((error: unknown) =>
      of<LearningViewState<T>>({ status: 'error', message: learningError(error) }),
    ),
    startWith<LearningViewState<T>>({ status: 'loading' }),
  );
}
