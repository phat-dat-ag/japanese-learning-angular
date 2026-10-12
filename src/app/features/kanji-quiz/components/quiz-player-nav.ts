import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-quiz-player-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Kanji Quiz" class="mb-6 flex flex-wrap gap-3 text-sm font-semibold">
      <a
        [routerLink]="['/kanji-quiz']"
        routerLinkActive="bg-indigo-50 text-indigo-700"
        [routerLinkActiveOptions]="{ exact: true }"
        ariaCurrentWhenActive="page"
        class="rounded-lg px-3 py-2 text-gray-700 hover:bg-indigo-50"
        >Game Setup</a
      >
      <a
        [routerLink]="['/kanji-quiz', 'history']"
        routerLinkActive="bg-indigo-50 text-indigo-700"
        ariaCurrentWhenActive="page"
        class="rounded-lg px-3 py-2 text-gray-700 hover:bg-indigo-50"
        >History</a
      >
      <a
        [routerLink]="['/kanji-quiz', 'progress']"
        routerLinkActive="bg-indigo-50 text-indigo-700"
        ariaCurrentWhenActive="page"
        class="rounded-lg px-3 py-2 text-gray-700 hover:bg-indigo-50"
        >Progress</a
      >
    </nav>
  `,
})
export class QuizPlayerNav { }
