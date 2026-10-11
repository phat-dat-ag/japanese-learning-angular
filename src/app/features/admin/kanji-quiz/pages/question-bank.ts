import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-question-bank',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="text-sm font-semibold text-indigo-700">Administration</p>
    <h1 class="mt-2 text-3xl font-bold tracking-tight text-gray-900">Kanji Quiz Question Bank</h1>
    <p class="mt-3 max-w-2xl leading-relaxed text-gray-600">
      A home for managing example-based and custom Kanji Quiz questions.
    </p>
    <section
      aria-labelledby="question-bank-heading"
      class="mt-8 rounded-2xl border border-gray-200 bg-white p-8 sm:p-14"
    >
      <h2 id="question-bank-heading" class="text-xl font-semibold text-gray-900">
        Question management is coming soon
      </h2>
      <p class="mt-3 leading-relaxed text-gray-600">
        Question browsing and editing will be available here in a future update.
      </p>
      <a
        [routerLink]="['/admin']"
        class="mt-6 inline-flex min-h-11 items-center rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Back to dashboard
      </a>
    </section>
  `,
})
export class QuestionBank { }
