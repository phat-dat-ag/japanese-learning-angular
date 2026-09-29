import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-vocabulary-header',
  template: `
    <header class="mb-8">
      <p class="text-sm font-semibold text-indigo-700">Vocabulary workspace</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-gray-900">{{ title() }}</h1>
      <p class="mt-3 max-w-2xl leading-relaxed text-gray-600">{{ description() }}</p>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyHeader {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
