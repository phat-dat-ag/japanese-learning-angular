import { CanDeactivateFn } from '@angular/router';
export const lessonEditorGuard: CanDeactivateFn<{ canLeave(): boolean }> = (page) =>
  page.canLeave();
