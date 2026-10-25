import { inject } from '@angular/core';
import { AuthSession } from '../../core/auth/auth-session.service';
import { Routes } from '@angular/router';

export const FLASHCARD_ROUTES: Routes = [
  {
    path: 'review',
    data: { kind: 'review' },
    loadComponent: () => import('./pages/learning-report').then((m) => m.LearningReport),
  },
  {
    path: 'bookmarks',
    data: { kind: 'bookmarks' },
    loadComponent: () => import('./pages/learning-report').then((m) => m.LearningReport),
  },
  {
    path: 'statistics',
    data: { kind: 'statistics' },
    loadComponent: () => import('./pages/learning-report').then((m) => m.LearningReport),
  },
  {
    path: 'learn/:lessonId',
    loadComponent: () => import('./pages/session-setup').then((m) => m.SessionSetup),
    canDeactivate: [
      (component: { busy: () => boolean }) =>
        !inject(AuthSession).authenticated() || !component.busy(),
    ],
  },
  {
    path: 'sessions/:sessionId',
    loadComponent: () => import('./pages/session/session').then((m) => m.LearningSession),
    canDeactivate: [
      (component: { player: { busy: () => boolean } }) =>
        !inject(AuthSession).authenticated() || !component.player.busy(),
    ],
  },
  {
    path: 'detail/:flashcardId',
    loadComponent: () => import('./pages/detail/detail').then((m) => m.FlashcardDetail),
  },
  {
    path: '',
    loadComponent: () => import('./pages/dashboard').then((m) => m.FlashcardDashboard),
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
