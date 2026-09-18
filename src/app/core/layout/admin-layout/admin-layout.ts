import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Header } from '../header/header';
import { AuthenticatedLayout } from '../authenticated-layout.directive';

@Component({
  selector: 'app-admin-layout',
  imports: [Header],
  hostDirectives: [AuthenticatedLayout],
  template: `
    <div class="min-h-screen bg-gray-50">
      <app-header [showNavigation]="false" />
      <main class="p-4 sm:p-6">
        <h1 class="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p class="mt-2 text-gray-600">
          Welcome to the Admin area. Administration features are coming later.
        </p>
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayout { }
