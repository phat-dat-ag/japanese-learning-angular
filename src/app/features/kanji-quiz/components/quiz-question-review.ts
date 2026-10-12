import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { QuizHistoryQuestion } from '../models/quiz-history.model';

@Component({
  selector: 'app-quiz-question-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="rounded-xl border border-gray-200 bg-white p-5">
      <h3 class="font-semibold text-gray-900">Question {{ question().questionNumber + 1 }}</h3>
      <p
        class="mt-2 font-semibold"
        [class.text-green-800]="question().correct"
        [class.text-red-700]="!question().correct"
      >
        {{ question().correct ? 'Correct' : 'Incorrect' }}
      </p>
      <p lang="ja" class="mt-3 break-words text-xl leading-relaxed">
        <span>{{ sentence().before }}</span
        ><mark class="rounded bg-indigo-100 px-1 text-indigo-900">{{ sentence().target }}</mark
        ><span>{{ sentence().after }}</span>
      </p>
      <dl class="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt class="text-sm text-gray-600">Target reading</dt>
          <dd lang="ja" class="break-words font-semibold">{{ sentence().target }}</dd>
        </div>
        <div>
          <dt class="text-sm text-gray-600">Selected answer</dt>
          <dd lang="ja" class="break-words font-semibold">{{ selectedAnswer() }}</dd>
        </div>
        <div>
          <dt class="text-sm text-gray-600">Correct answer</dt>
          <dd lang="ja" class="break-words font-semibold">{{ correctAnswer() }}</dd>
        </div>
      </dl>
      @if (question().explanationVi) {
        <p lang="vi" class="mt-4 whitespace-pre-wrap text-gray-700">
          {{ question().explanationVi }}
        </p>
      }
      @if (question().explanationEn) {
        <p lang="en" class="mt-4 whitespace-pre-wrap text-gray-700">
          {{ question().explanationEn }}
        </p>
      }
      <p class="mt-4 text-sm text-gray-600">
        Answered:
        <time [attr.datetime]="question().answeredAt + 'Z'"
          >{{ question().answeredAt.replace('T', ' ') }} UTC</time
        >
      </p>
    </article>
  `,
})
export class QuizQuestionReview {
  readonly question = input.required<QuizHistoryQuestion>();
  readonly sentence = computed(() => {
    const question = this.question();
    const points = Array.from(question.sentenceReading);
    const end = question.targetStart + question.targetLength;
    return {
      before: points.slice(0, question.targetStart).join(''),
      target: points.slice(question.targetStart, end).join(''),
      after: points.slice(end).join(''),
    };
  });
  readonly selectedAnswer = computed(
    () =>
      this.question().options.find((option) => option.id === this.question().selectedOptionId)
        ?.text,
  );
  readonly correctAnswer = computed(
    () =>
      this.question().options.find((option) => option.id === this.question().correctOptionId)?.text,
  );
}
