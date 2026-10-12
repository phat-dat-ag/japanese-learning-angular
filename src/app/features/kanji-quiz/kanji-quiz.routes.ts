import { Routes } from '@angular/router';

export const KANJI_QUIZ_ROUTES: Routes = [
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
