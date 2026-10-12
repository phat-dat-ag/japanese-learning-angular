import { Routes } from '@angular/router';

export const KANJI_QUIZ_ROUTES: Routes = [
  {
    path: 'history',
    loadComponent: () => import('./pages/quiz-history').then((m) => m.QuizHistory),
  },
  {
    path: 'progress',
    loadComponent: () => import('./pages/quiz-progress').then((m) => m.QuizProgress),
  },
  {
    path: 'sessions/:sessionId/results',
    loadComponent: () => import('./pages/quiz-results').then((m) => m.QuizResults),
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/game-setup').then((m) => m.GameSetup),
  },
  {
    path: 'sessions/:sessionId',
    loadComponent: () => import('./pages/gameplay').then((m) => m.Gameplay),
  },
];
