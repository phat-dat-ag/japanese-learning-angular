import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { Flashcard as FlashcardModel } from '../../models/flashcard.model';

function splitMorae(reading: string): string[] {
  const morae: string[] = [];
  for (const character of reading.normalize('NFC')) {
    // Small combining kana share a mora; っ, ん and long vowels count separately.
    if (morae.length && /^[ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ\u3099\u309a]$/u.test(character)) {
      morae[morae.length - 1] += character;
    } else {
      morae.push(character);
    }
  }
  return morae;
}

@Component({
  selector: 'app-flashcard',
  templateUrl: './flashcard.html',
  styleUrl: './flashcard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Flashcard {
  readonly card = input.required<FlashcardModel>();
  readonly flipped = linkedSignal({ source: this.card, computation: () => false });
  readonly examples = computed(() => this.card().examples.slice(0, 2));
  readonly readings = computed(() =>
    this.card().readings.map((reading) => {
      const morae = splitMorae(reading.reading);
      const accents = [...new Set(reading.pitchAccents)].filter(
        (accent) => accent >= 0 && accent <= morae.length,
      );
      return {
        text: reading.reading,
        morae,
        accents: accents.length ? accents : [null],
      };
    }),
  );

  flip(): void {
    this.flipped.update((value) => !value);
  }
}
