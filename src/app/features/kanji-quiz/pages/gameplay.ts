import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

@Component({
  selector: 'app-quiz-gameplay',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6">
      <h1 class="text-2xl font-bold text-gray-900">Kanji Quiz</h1>
      @if (sessionId(); as id) {
        <p class="mt-4 text-gray-700">Session {{ id }}</p>
        <p class="mt-2 text-gray-600">Gameplay is not available yet.</p>
      } @else {
        <p role="alert" class="mt-4 text-red-700">Invalid session ID.</p>
      }
      <a
        [routerLink]="['/kanji-quiz']"
        class="mt-6 inline-block font-semibold text-indigo-700 underline"
      >
        Back to Game Setup
      </a>
    </section>
  `,
})
export class Gameplay {
  readonly sessionId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => {
        const id = params.get('sessionId');
        return id && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)) ? id : null;
      }),
    ),
  );
}
