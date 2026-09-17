import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthSession } from '../../auth/auth-session.service';
import { AuthService } from '../../auth/auth.service';
import { authInterceptor } from '../../auth/auth.interceptor';
import { authGuard } from '../../auth/auth.guard';
import { Header } from './header';

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let http: HttpTestingController;
  let session: AuthSession;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
      imports: [Header],
    }).compileComponents();
    fixture = TestBed.createComponent(Header);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSession);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('shows sign-in for an anonymous user', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('a[href="/login"]')?.textContent).toContain('Sign in');
  });

  it.each([204, 500])('signs out once, clears identity, and navigates on HTTP %s', (status) => {
    session.replace({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60 });
    session.setUser({
      userId: 'id',
      username: 'Authoritative username',
      email: 'learner@example.test',
    });
    const logout = vi.spyOn(TestBed.inject(AuthService), 'logout');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Authoritative username');
    const button = Array.from(element.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Sign out'),
    );
    button?.click();
    fixture.componentInstance.logout();
    fixture.detectChanges();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(button?.disabled).toBe(true);
    expect(element.textContent).toContain('Signing out...');
    expect(session.tokens()).toBeNull();
    expect(session.user()).toBeNull();
    http
      .expectOne('/api/auth/logout')
      .flush(status === 204 ? null : { error: 'private diagnostic' }, {
        status,
        statusText: 'Response',
      });
    fixture.detectChanges();
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(session.authenticated()).toBe(false);
    expect(TestBed.runInInjectionContext(() => authGuard()).toString()).toBe('/login');
    expect(element.textContent).not.toContain('Authoritative username');
    expect(element.textContent).not.toContain('private diagnostic');
    if (status === 500)
      expect(element.querySelector('[role=alert]')?.textContent).toContain('Signed out locally');
    else expect(element.querySelector('[role=alert]')).toBeNull();
  });
});
