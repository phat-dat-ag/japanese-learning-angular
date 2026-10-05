import { Routes } from '@angular/router';
import { ADMIN_SECTIONS } from './admin-sections';

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
  ...ADMIN_SECTIONS.filter(
    (section) => section.path !== 'vocabulary' && section.path !== 'lessons',
  ).map((section) => ({
    path: section.path,
    title: section.title,
    loadComponent: () => import('./pages/section').then((m) => m.AdminSection),
  })),
];
