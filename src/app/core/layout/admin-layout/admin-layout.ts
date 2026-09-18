import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { ADMIN_SECTIONS } from '../../../features/admin/admin-sections';
import { Header } from '../header/header';
import { AuthenticatedLayout } from '../authenticated-layout.directive';

@Component({
  selector: 'app-admin-layout',
  imports: [Header, RouterLink, RouterLinkActive, RouterOutlet],
  hostDirectives: [AuthenticatedLayout],
  templateUrl: './admin-layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayout {
  private readonly route = inject(ActivatedRoute);
  readonly sections = ADMIN_SECTIONS;
  readonly menuOpen = signal(false);
  readonly pageTitle = toSignal(
    inject(Router).events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.route.firstChild?.snapshot?.title ?? 'Admin Dashboard'),
    ),
    { initialValue: 'Admin Dashboard' },
  );
}
