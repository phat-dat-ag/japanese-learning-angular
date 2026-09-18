import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-guest',
  imports: [RouterLink],
  template: `
    <section class="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-6">
      <h1 class="text-3xl font-bold text-gray-900">Japanese Learning</h1>
      <p class="mt-2 text-gray-600">Welcome, guest. Sign in or register to start learning.</p>
      <nav aria-label="Guest actions" class="mt-6 flex gap-4">
        <a [routerLink]="['/login']" class="font-medium text-indigo-700 underline">Login</a>
        <a [routerLink]="['/register']" class="font-medium text-indigo-700 underline">Register</a>
      </nav>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Guest { }
