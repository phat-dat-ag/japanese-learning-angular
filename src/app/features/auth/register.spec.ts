import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { AuthSession } from '../../core/auth/auth-session.service';
import { Register } from './register';

const registered = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'learner',
  email: 'learner@example.test',
  createdAt: '2026-09-16T00:00:00Z',
};

describe('Register', () => {
  let fixture: ComponentFixture<Register>;
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Register);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  function fill(): Register {
    const page = fixture.componentInstance;
    page.username = 'learner';
    page.email = 'learner@example.test';
    page.password = 'test-password';
    page.confirmPassword = page.password;
    return page;
  }

  it('posts only the actual contract through the Gateway without persisting credentials or signing in', () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const page = fill();
    page.submit();
    page.submit();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true);
    expect(page.password).toBe('');
    expect(page.confirmPassword).toBe('');
    const request = http.expectOne('/api/auth/register');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      username: 'learner',
      email: 'learner@example.test',
      password: 'test-password',
    });
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(registered, { status: 201, statusText: 'Created' });
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { registered: 'true' } });
    expect(TestBed.inject(AuthSession).tokens()).toBeNull();
    expect(TestBed.inject(AuthSession).user()).toBeNull();
    expect(storage).not.toHaveBeenCalled();
    expect(page.loading()).toBe(false);
    http.expectNone('/api/auth/login');
    http.expectNone('/api/auth/me');
  });

  it.each([
    { username: '   ' },
    { username: 'a'.repeat(101) },
    { email: 'invalid' },
    { email: 'a'.repeat(250) + '@x.test' },
    { password: 'short', confirmPassword: 'short' },
    { password: ' '.repeat(8), confirmPassword: ' '.repeat(8) },
    { password: 'a'.repeat(101), confirmPassword: 'a'.repeat(101) },
    { confirmPassword: 'different' },
  ])('does not submit invalid registration fields', (values) => {
    const page = fill();
    Object.assign(page, values);
    page.submit();
    http.expectNone('/api/auth/register');
    expect(page.loading()).toBe(false);
  });

  it.each([
    ['EMAIL_ALREADY_EXISTS', 'This email is already registered.'],
    ['USERNAME_ALREADY_EXISTS', 'This username is already taken.'],
    ['UNKNOWN_CONFLICT', 'Unable to create your account.'],
  ])('handles %s using a safe message', (code, message) => {
    fill().submit();
    http
      .expectOne('/api/auth/register')
      .flush(
        { success: false, error: { code, message: 'private diagnostic' }, traceId: 'trace' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('[role=alert]')?.textContent).toContain(message);
    expect(element.textContent).not.toContain('private diagnostic');
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it.each([400, 401, 500, 0])('shows a safe error on HTTP %s without refresh', (status) => {
    fill().submit();
    http
      .expectOne('/api/auth/register')
      .flush({ message: 'private diagnostic' }, { status, statusText: 'Failed' });
    expect(fixture.componentInstance.error()).toContain('Unable to create your account');
    http.expectNone('/api/auth/refresh');
  });

  it('provides labeled password fields, validation feedback, and a sign-in link', async () => {
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    for (const name of ['username', 'email', 'password', 'confirmPassword']) {
      expect(element.querySelector('label[for="' + name + '"]')).not.toBeNull();
    }
    for (const name of ['password', 'confirmPassword']) {
      const input = element.querySelector<HTMLInputElement>('input[name="' + name + '"]');
      expect(input?.type).toBe('password');
      expect(input?.autocomplete).toBe('new-password');
    }
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/login');
    const username = element.querySelector<HTMLInputElement>('input[name=username]');
    username?.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(username?.getAttribute('aria-invalid')).toBe('true');
    expect(element.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true);
  });
  it('enables submission only when entered fields and password confirmation are valid', async () => {
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const enter = async (name: string, value: string) => {
      const input = element.querySelector<HTMLInputElement>('input[name="' + name + '"]');
      if (!input) throw new Error('Missing form field');
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      await fixture.whenStable();
    };
    await enter('username', 'learner');
    await enter('email', 'learner@example.test');
    await enter('password', 'test-password');
    await enter('confirmPassword', 'different');
    const button = element.querySelector<HTMLButtonElement>('button[type=submit]');
    expect(button?.disabled).toBe(true);
    expect(element.querySelector('input[name=confirmPassword]')?.getAttribute('aria-invalid')).toBe(
      'true',
    );
    await enter('confirmPassword', 'test-password');
    expect(button?.disabled).toBe(false);
    expect(element.querySelector('input[name=confirmPassword]')?.getAttribute('aria-invalid')).toBe(
      'false',
    );
  });
});
