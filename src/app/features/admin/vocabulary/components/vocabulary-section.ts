import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-vocabulary-section',
  host: { class: 'block min-w-0 [overflow-wrap:anywhere]' },
  template: `
    <section
      [attr.aria-labelledby]="headingId()"
      class="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6"
    >
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 [id]="headingId()" class="text-xl font-semibold text-gray-900">{{ title() }}</h2>
          <p class="mt-2 text-sm text-gray-600">{{ description() }}</p>
        </div>
        <ng-content select="[sectionActions]" />
      </div>
      <ng-content />
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularySection {
  readonly title = input.required<string>();
  readonly headingId = input.required<string>();
  readonly description = input.required<string>();
}
