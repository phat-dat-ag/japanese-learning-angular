import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./core/layout/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      { path: 'login', loadComponent: () => import('./features/auth/login').then((m) => m.Login) },
      {
        path: '',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'flashcards',
        canActivate: [authGuard],
        canActivateChild: [authGuard],
        loadChildren: () =>
          import('./features/flashcard/flashcard.routes').then((m) => m.FLASHCARD_ROUTES),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
