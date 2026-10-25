import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LearningStatistics } from '../models/learning.model';

@Component({
  selector: 'app-progress-summary',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@let s = statistics();
    <div class="rounded-xl border border-gray-200 bg-white p-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <p>Studied {{ s.studiedPercentage | number: '1.0-2' }}%</p>
          <progress
            class="w-full accent-indigo-600"
            max="100"
            [value]="s.studiedPercentage"
            aria-label="Studied percentage"
          ></progress>
        </div>
        <div>
          <p>Mastered {{ s.masteryPercentage | number: '1.0-2' }}%</p>
          <progress
            class="w-full accent-teal-600"
            max="100"
            [value]="s.masteryPercentage"
            aria-label="Mastery percentage"
          ></progress>
        </div>
      </div>
      <dl class="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt>New</dt>
          <dd class="font-semibold">{{ s.newCount }}</dd>
        </div>
        <div>
          <dt>Learning</dt>
          <dd class="font-semibold">{{ s.learningCount }}</dd>
        </div>
        <div>
          <dt>Review</dt>
          <dd class="font-semibold">{{ s.reviewCount }}</dd>
        </div>
        <div>
          <dt>Mastered</dt>
          <dd class="font-semibold">{{ s.masteredCount }}</dd>
        </div>
      </dl>
      <p class="mt-3 text-sm text-gray-600">
        {{ s.dueCount }} due · {{ s.studiedCount }} studied of
        {{ s.totalVocabularyCount }} vocabulary
      </p>
    </div>`,
})
export class ProgressSummary {
  readonly statistics = input.required<LearningStatistics>();
}
