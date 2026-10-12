import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { QuizProgressBucket } from '../models/quiz-progress.model';

@Component({
  selector: 'app-quiz-progress-breakdown',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3 class="text-lg font-semibold text-gray-900">{{ title() }}</h3>
    @if (buckets().length) {
      <div class="mt-3 overflow-x-auto rounded-xl border border-gray-200">
        <table class="w-full text-left text-sm">
          <caption class="sr-only">
            {{
              title()
            }}
          </caption>
          <thead class="bg-gray-50 text-gray-700">
            <tr>
              <th scope="col" class="p-3">Classification</th>
              <th scope="col" class="p-3">Sessions</th>
              <th scope="col" class="p-3">Answers</th>
              <th scope="col" class="p-3">Correct</th>
              <th scope="col" class="p-3">Incorrect</th>
              <th scope="col" class="p-3">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            @for (
              bucket of buckets();
              track bucket.classification + ':' + bucket.levelId + ':' + bucket.lessonId
            ) {
              <tr class="border-t border-gray-200">
                <th scope="row" class="p-3 font-medium">{{ label(bucket) }}</th>
                <td class="p-3">{{ bucket.completedSessions }}</td>
                <td class="p-3">{{ bucket.answeredCount }}</td>
                <td class="p-3">{{ bucket.correctCount }}</td>
                <td class="p-3">{{ bucket.incorrectCount }}</td>
                <td class="p-3">{{ bucket.accuracyPercentage | number: '1.2-2' }}%</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <p class="mt-3 text-gray-600">No classifications to display.</p>
    }
  `,
})
export class QuizProgressBreakdownTable {
  readonly title = input.required<string>();
  readonly buckets = input.required<readonly QuizProgressBucket[]>();

  label(bucket: QuizProgressBucket): string {
    if (bucket.classification === 'UNKNOWN') return 'UNKNOWN — classification not captured';
    if (bucket.classification === 'UNASSIGNED')
      return 'UNASSIGNED — captured without an assignment';
    return bucket.lessonId == null
      ? 'Level ID ' + bucket.levelId
      : 'Level ID ' + bucket.levelId + ' / Lesson ID ' + bucket.lessonId;
  }
}
