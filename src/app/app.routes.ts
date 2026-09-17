import { Routes } from '@angular/router';
import { guestGuard } from './core/auth/guest.guard';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./core/layout/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      {
        path: 'login',
        data: { authPage: true },
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/login').then((m) => m.Login),
      },
      {
        path: 'register',
        data: { authPage: true },
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/register').then((m) => m.Register),
      },
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
