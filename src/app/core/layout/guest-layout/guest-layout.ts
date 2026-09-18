import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from '../header/header';

@Component({
  selector: 'app-guest-layout',
  imports: [Header, RouterOutlet],
  template: `
    <div class="min-h-screen bg-gray-50">
      <app-header [showNavigation]="false" />
      <main class="p-4 sm:p-6">
        <router-outlet />
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestLayout { }
