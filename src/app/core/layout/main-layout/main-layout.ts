import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';
import { Footer } from '../footer/footer';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Header, Sidebar, Footer],
  templateUrl: './main-layout.html',
})
export class MainLayout {
  private readonly route = inject(ActivatedRoute);
  readonly authPage = toSignal(
    inject(Router).events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.route.firstChild?.snapshot?.data['authPage'] === true),
    ),
    { initialValue: false },
  );
  isSidebarOpen = signal(true);

  toggleSidebar() {
    this.isSidebarOpen.update((isOpen) => !isOpen);
  }
}
