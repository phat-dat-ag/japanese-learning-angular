import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GrammarDocument } from '../models/grammar-content.model';
import { GrammarInlinePreview } from './grammar-inline-preview';

@Component({
  selector: 'app-grammar-content',
  imports: [GrammarInlinePreview],
  templateUrl: './grammar-content.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrammarContent {
  readonly document = input.required<GrammarDocument>();
}
