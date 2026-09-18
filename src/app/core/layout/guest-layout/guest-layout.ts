import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-guest-layout',
  imports: [RouterLink, RouterOutlet],
  template: `
    <div class="flex min-h-screen flex-col bg-gray-50">
      <header class="border-b border-gray-200 bg-white">
        <nav
          aria-label="Guest navigation"
          class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6"
        >
          <a
            [routerLink]="['/']"
            class="flex items-center gap-2 rounded-lg font-bold text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <span
              aria-hidden="true"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white"
              >日</span
            >
            <span class="text-sm sm:text-base">Japanese Learning</span>
          </a>
          <div class="flex items-center gap-2">
            <a
              [routerLink]="['/login']"
              class="inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >Login</a
            >
            <a
              [routerLink]="['/register']"
              class="inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >Register</a
            >
          </div>
        </nav>
      </header>
      <main class="flex-1 px-4 sm:px-6">
        <router-outlet />
      </main>
      <footer class="border-t border-gray-200 bg-white px-4 py-6 sm:px-6">
        <div
          class="mx-auto flex max-w-6xl flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="font-semibold text-gray-700">Japanese Learning</p>
          <p class="text-gray-500">Learn Japanese, one step at a time.</p>
        </div>
      </footer>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestLayout { }
