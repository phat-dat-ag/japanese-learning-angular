import { Routes } from '@angular/router';
import { guestGuard, guestLayoutMatch } from './core/auth/guest.guard';
import { adminGuard, userGuard } from './core/auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    canMatch: [guestLayoutMatch],
    loadComponent: () =>
      import('./core/layout/guest-layout/guest-layout').then((m) => m.GuestLayout),
    children: [
      {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/login').then((m) => m.Login),
      },
      {
        path: 'register',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/register').then((m) => m.Register),
      },
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/auth/guest').then((m) => m.Guest),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./core/layout/admin-layout/admin-layout').then((m) => m.AdminLayout),
  },
  {
    path: '',
    canActivate: [userGuard],
    canActivateChild: [userGuard],
    loadComponent: () => import('./core/layout/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'flashcards',
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
