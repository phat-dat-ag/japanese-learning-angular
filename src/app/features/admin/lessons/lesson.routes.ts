import { Routes } from '@angular/router';
import { lessonEditorGuard } from './lesson-editor.guard';

export const LESSON_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Lesson Management',
    loadComponent: () => import('./pages/lesson-list').then((m) => m.LessonList),
  },
  {
    path: 'import/metadata',
    title: 'Import Lesson Metadata',
    data: { importKind: 'lessons' },
    loadComponent: () => import('../imports/file-import').then((m) => m.FileImport),
  },
  {
    path: 'import',
    title: 'Import Complete Grammar Lessons',
    canDeactivate: [lessonEditorGuard],
    loadComponent: () => import('./pages/lesson-import').then((m) => m.LessonImport),
  },
  {
    path: 'new',
    title: 'Create Lesson',
    canDeactivate: [lessonEditorGuard],
    loadComponent: () => import('./pages/lesson-editor').then((m) => m.LessonEditor),
  },
  {
    path: ':lessonId/content',
    title: 'Grammar Lesson Content',
    canDeactivate: [lessonEditorGuard],
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    loadComponent: () => import('./pages/lesson-content-editor').then((m) => m.LessonContentEditor),
  },
  {
    path: ':lessonId/edit',
    title: 'Edit Lesson',
    canDeactivate: [lessonEditorGuard],
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    loadComponent: () => import('./pages/lesson-editor').then((m) => m.LessonEditor),
  },
];
