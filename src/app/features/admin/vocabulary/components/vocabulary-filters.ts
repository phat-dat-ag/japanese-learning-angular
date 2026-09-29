import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FlashcardLesson } from '../../../flashcard/models/flashcard-lesson.model';
import { JlptLevel } from '../../../flashcard/models/jlpt-level.model';
import { LoadState, VocabularyQuery } from '../models/vocabulary.model';

@Component({
  selector: 'app-vocabulary-filters',
  templateUrl: './vocabulary-filters.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyFilters {
  readonly query = input.required<VocabularyQuery>();
  readonly levelState = input.required<LoadState<readonly JlptLevel[]>>();
  readonly lessonState = input.required<LoadState<readonly FlashcardLesson[]>>();
  readonly pageSizes = input.required<readonly number[]>();
  readonly levelChanged = output<string>();
  readonly lessonChanged = output<string>();
  readonly sizeChanged = output<string>();
  readonly filtersCleared = output<void>();
  readonly levelsRetried = output<void>();
  readonly lessonsRetried = output<void>();
}
