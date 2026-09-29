import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { VocabularyHeader } from '../components/vocabulary-header';

@Component({
  selector: 'app-admin-vocabulary-detail',
  imports: [RouterLink, VocabularyHeader],
  template: `
    <app-vocabulary-header
      title="Vocabulary details"
      description="A dedicated workspace for managing a vocabulary entry."
    />
    <section class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
      @if (vocabularyId(); as id) {
        <p class="text-sm font-semibold text-indigo-700">Selected vocabulary · ID {{ id }}</p>
        <h2 class="mt-3 text-xl font-semibold text-gray-900">Detail management is coming next</h2>
        <p class="mt-3 max-w-2xl leading-relaxed text-gray-600">
          This entry's details and editing tools are not available yet. Return to the vocabulary
          list to continue browsing.
        </p>
      } @else {
        <h2 class="text-xl font-semibold text-gray-900" role="alert">Invalid vocabulary ID</h2>
        <p class="mt-3 text-gray-600">Choose an entry from the vocabulary list to continue.</p>
      }
      <a
        [routerLink]="['/admin', 'vocabulary']"
        class="mt-6 inline-flex min-h-11 items-center rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >Back to vocabulary list</a
      >
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyDetail {
  readonly vocabularyId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => {
        const rawId = params.get('vocabularyId') ?? '';
        const id = Number(rawId);
        return /^\d+$/.test(rawId) && Number.isSafeInteger(id) && id > 0 ? id : null;
      }),
    ),
  );
}
