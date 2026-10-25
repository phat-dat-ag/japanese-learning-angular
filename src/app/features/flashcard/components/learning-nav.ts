import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-learning-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav
    aria-label="Flashcard learning"
    class="mb-6 flex flex-wrap gap-4 text-sm text-indigo-700"
  >
    @for (link of links; track link.path) {
      <a
        [routerLink]="link.path"
        routerLinkActive="font-bold"
        [routerLinkActiveOptions]="{ exact: true }"
        ariaCurrentWhenActive="page"
        class="rounded px-1 py-2 underline focus-visible:outline-2"
        >{{ link.label }}</a
      >
    }
  </nav>`,
})
export class LearningNav {
  readonly links = [
    { path: '/flashcards', label: 'Dashboard' },
    { path: '/flashcards/review', label: 'Review' },
    { path: '/flashcards/bookmarks', label: 'Bookmarks' },
    { path: '/flashcards/statistics', label: 'Statistics' },
  ];
}
