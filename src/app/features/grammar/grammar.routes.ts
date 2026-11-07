import { Routes } from '@angular/router';

export const GRAMMAR_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Grammar Lessons',
    loadComponent: () => import('./pages/grammar-lessons').then((m) => m.GrammarLessons),
  },
  {
    path: ':lessonId',
    title: 'Grammar Lesson',
    loadComponent: () => import('./pages/grammar-lesson-reader').then((m) => m.GrammarLessonReader),
  },
];
