import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { Login } from './login';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Login);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('uses accessible credential fields and disables duplicate submissions', () => {
    const page = fixture.componentInstance;
    page.email = 'learner@example.test';
    page.password = 'test-password';
    page.submit();
    page.submit();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('input[name=password]')?.getAttribute('type')).toBe('password');
    expect(element.querySelector('label[for=email]')).not.toBeNull();
    expect(element.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true);
    expect(page.password).toBe('');
    http.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
  });

  it('shows a safe error and permits another attempt', () => {
    const page = fixture.componentInstance;
    page.email = 'learner@example.test';
    page.password = 'test-password';
    page.submit();
    http
      .expectOne('/api/auth/login')
      .flush({ error: 'private backend diagnostic' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('[role=alert]')?.textContent).toContain('Unable to sign in');
    expect(element.textContent).not.toContain('private backend diagnostic');
    expect(page.loading()).toBe(false);
    page.password = 'retry-password';
    page.submit();
    http.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
  });

  it('navigates to protected flashcards after login and /me succeed', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const page = fixture.componentInstance;
    page.email = 'learner@example.test';
    page.password = 'test-password';
    page.submit();
    http
      .expectOne('/api/auth/login')
      .flush({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60 });
    http.expectOne('/api/auth/me').flush({ userId: 'user-id', email: page.email });
    expect(navigate).toHaveBeenCalledWith(['/flashcards']);
    expect(page.loading()).toBe(false);
  });
  it('links to registration and rejects invalid email submission', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/register');
    fixture.componentInstance.email = 'invalid';
    fixture.componentInstance.password = 'test-password';
    fixture.componentInstance.submit();
    http.expectNone('/api/auth/login');
  });
});
