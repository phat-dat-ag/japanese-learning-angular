import { Routes } from '@angular/router';
import { ADMIN_SECTIONS } from './admin-sections';
import { questionEditorGuard } from './kanji-quiz/question-editor.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Admin Dashboard',
    loadComponent: () => import('./pages/dashboard').then((m) => m.AdminDashboard),
  },
  {
    path: 'vocabulary',
    title: 'Vocabulary Management',
    loadComponent: () => import('./vocabulary/pages/vocabulary-list').then((m) => m.VocabularyList),
  },
  {
    path: 'vocabulary/import',
    title: 'Import Vocabulary',
    data: { importKind: 'vocabulary' },
    loadComponent: () => import('./imports/file-import').then((m) => m.FileImport),
  },
  {
    path: 'lessons',
    title: 'Lesson Management',
    data: { importKind: 'lessons' },
    loadComponent: () => import('./imports/file-import').then((m) => m.FileImport),
  },
  {
    path: 'vocabulary/:vocabularyId',
    title: 'Vocabulary details',
    loadComponent: () =>
      import('./vocabulary/pages/vocabulary-detail').then((m) => m.VocabularyDetail),
  },
  {
    path: 'kanji-quiz/questions',
    title: 'Kanji Quiz Question Bank',
    loadComponent: () => import('./kanji-quiz/pages/question-bank').then((m) => m.QuestionBank),
  },
  {
    path: 'kanji-quiz/questions/import',
    title: 'Kanji Quiz JSON Import Preview',
    canDeactivate: [questionEditorGuard],
    loadComponent: () => import('./kanji-quiz/pages/question-import').then((m) => m.QuestionImport),
  },
  {
    path: 'kanji-quiz/questions/new',
    title: 'Create Kanji Quiz Question',
    canDeactivate: [questionEditorGuard],
    loadComponent: () => import('./kanji-quiz/pages/question-editor').then((m) => m.QuestionEditor),
  },
  {
    path: 'kanji-quiz/questions/:questionId/edit',
    title: 'Edit Kanji Quiz Question',
    canDeactivate: [questionEditorGuard],
    loadComponent: () => import('./kanji-quiz/pages/question-editor').then((m) => m.QuestionEditor),
  },
  ...ADMIN_SECTIONS.filter(
    (section) =>
      section.path !== 'vocabulary' &&
      section.path !== 'lessons' &&
      section.path !== 'kanji-quiz/questions',
  ).map((section) => ({
    path: section.path,
    title: section.title,
    loadComponent: () => import('./pages/section').then((m) => m.AdminSection),
  })),
];
