import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { JlptLevel } from '../../models/jlpt-level.model';

@Component({
  selector: 'app-level-card',
  imports: [RouterLink],
  templateUrl: './level-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LevelCard {
  readonly level = input.required<JlptLevel>();
  readonly levelId = computed(() => this.level().code.toLowerCase());
}
