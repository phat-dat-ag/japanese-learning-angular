import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ADMIN_SECTIONS } from '../admin-sections';

@Component({
  selector: 'app-admin-section',
  imports: [RouterLink],
  template: `
    @if (section(); as current) {
      <p class="text-sm font-semibold text-indigo-700">Administration</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-gray-900">{{ current.title }}</h1>
      <p class="mt-3 max-w-2xl leading-relaxed text-gray-600">{{ current.description }}</p>
      <section
        aria-labelledby="coming-soon"
        class="mt-8 rounded-2xl border border-gray-200 bg-white p-8 text-center sm:p-14"
      >
        <span
          aria-hidden="true"
          class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-700"
          >準</span
        >
        <p class="mt-6 text-xs font-semibold uppercase tracking-wider text-indigo-700">
          Coming soon
        </p>
        <h2 id="coming-soon" class="mt-2 text-xl font-semibold text-gray-900">
          {{ current.label }} tools are on the way
        </h2>
        <p class="mx-auto mt-3 max-w-md leading-relaxed text-gray-600">
          This area is being prepared. Management actions are not available yet.
        </p>
        <a
          [routerLink]="['/admin']"
          class="mt-6 inline-flex min-h-11 items-center rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >Back to dashboard</a
        >
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSection {
  readonly section = toSignal(
    inject(ActivatedRoute).url.pipe(
      map((segments) => ADMIN_SECTIONS.find((section) => section.path === segments[0]?.path)),
    ),
  );
}
