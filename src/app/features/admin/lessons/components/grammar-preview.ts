import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GrammarDocument } from '../models/grammar-content.model';
import { GrammarInlinePreview } from './grammar-inline-preview';

@Component({
  selector: 'app-grammar-preview',
  imports: [GrammarInlinePreview],
  templateUrl: './grammar-preview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrammarPreview {
  readonly document = input.required<GrammarDocument>();
}
