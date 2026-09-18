import { Routes } from '@angular/router';
import { ADMIN_SECTIONS } from './admin-sections';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Admin Dashboard',
    loadComponent: () => import('./pages/dashboard').then((m) => m.AdminDashboard),
  },
  ...ADMIN_SECTIONS.map((section) => ({
    path: section.path,
    title: section.title,
    loadComponent: () => import('./pages/section').then((m) => m.AdminSection),
  })),
];
