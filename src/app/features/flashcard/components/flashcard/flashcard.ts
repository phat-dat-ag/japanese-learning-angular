import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Flashcard as FlashcardModel } from '../../models/flashcard.model';

@Component({
  selector: 'app-flashcard',
  templateUrl: './flashcard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Flashcard {
  readonly card = input.required<FlashcardModel>();
}
