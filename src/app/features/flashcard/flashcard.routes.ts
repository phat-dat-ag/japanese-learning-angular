import { Routes } from '@angular/router';

export const FLASHCARD_ROUTES: Routes = [
  {
    path: 'detail/:flashcardId',
    loadComponent: () => import('./pages/detail/detail').then((m) => m.FlashcardDetail),
  },
  {
    path: '',
    loadComponent: () => import('./pages/level-list/level-list').then((m) => m.LevelList),
  },
  {
    path: ':level',
    loadComponent: () => import('./pages/lesson-list/lesson-list').then((m) => m.LessonList),
  },
  {
    path: ':level/lessons/:lessonId',
    loadComponent: () => import('./pages/study/study').then((m) => m.Study),
  },
];
