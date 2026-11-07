import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GrammarContent } from '../../../grammar/components/grammar-content';
import { GrammarDocument } from '../models/grammar-content.model';

@Component({
  selector: 'app-grammar-preview',
  imports: [GrammarContent],
  template: '<app-grammar-content [document]="document()" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrammarPreview {
  readonly document = input.required<GrammarDocument>();
}
