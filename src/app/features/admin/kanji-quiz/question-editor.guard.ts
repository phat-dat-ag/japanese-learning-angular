import { CanDeactivateFn } from '@angular/router';

export interface QuestionEditorNavigation {
  canLeave(): boolean;
}

export const questionEditorGuard: CanDeactivateFn<QuestionEditorNavigation> = (component) =>
  component.canLeave();
