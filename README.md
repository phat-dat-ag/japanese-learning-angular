# Japanese Learning

An Angular frontend for learning Japanese through JLPT levels, lessons, and vocabulary flashcards.

## Features

- Browse JLPT levels from N5 to N1 and view their lessons.
- Study vocabulary with Japanese words, readings, meanings, and example sentences.
- Reveal card answers and move through a lesson with a progress indicator.
- Navigate through a shared header, collapsible sidebar, and footer.

JLPT levels, lessons, paginated flashcards, and card details are loaded through the API Gateway.

## Tech stack

| Technology                  | Purpose                 |
| --------------------------- | ----------------------- |
| Angular 22 and TypeScript 6 | Application and routing |
| Tailwind CSS 4              | Styling                 |
| RxJS 7                      | Reactive utilities      |
| Vitest 4 and jsdom          | Unit testing            |

## Getting started

Install Node.js 24.x and npm 11.x, then run these commands from the directory containing `package.json`:

```bash
npm ci
npm start
```

Open [localhost:4200](http://localhost:4200). The development server reloads when source files change.

Start the backend Docker Compose stack with the NGINX API Gateway exposed on `http://localhost:8080`, then open **Flashcards** to browse the available levels and lessons.

## API configuration

All backend requests use the single `API_CONFIG` token in `src/app/core/api/api.config.ts`. The default `baseUrl` is `/api` with a 15-second timeout. Feature paths include their version where required: `v1/jlpt-levels`, `v1/lessons`, and `v1/flashcards`. Unversioned routes such as `auth/login` and `vocabularies` share the same API root; do not repeat `/api` in feature paths.

During development, the existing `proxy.conf.json` forwards only `/api/**` to `http://localhost:8080` (the Gateway), preserving paths. `angular.json` enables this for `npm start`. Browser requests remain same-origin, for example `/api/v1/flashcards`; the proxy forwards them to the Gateway. Restart `npm start` after changing proxy settings. Backend debugging ports must not be used by Angular.

For production, configure the frontend/edge server to forward `/api/**` to the Gateway and serve Angular routes through `index.html`. The development proxy is not included in the production build. No development hostname is bundled into the application. If deployment needs a separate Gateway origin, override `API_CONFIG` in `app.config.ts` with a base such as `https://gateway.example/api` and the timeout; allow only the required frontend origin at the Gateway.

Quarkus services keep the existing `ApiClient` envelope validation, metadata, timeout, and normalized errors. Authentication uses `AuthApi` with Angular `HttpClient` because .NET returns plain success bodies. It reuses `API_CONFIG`, runtime validation, the configured timeout, and `normalizeApiError`; no Quarkus response contract is changed.

## Authentication

Use **Sign in** in the header to open `/login`, or **Create account** to open `/register`. Both forms provide accessible validation and submission states and clear password fields on submission. Registration creates an account, then opens Login with a success message; it does not authenticate or carry credentials between pages. Signed-in users are redirected from either auth page to Flashcards. The header shows the authoritative `/me` username (email as a fallback) and provides Sign out, with duplicate submissions disabled and safe feedback if server revocation cannot be confirmed.

The inspected .NET contract is:

| Operation                 | Request                         | Success response                                     |
| ------------------------- | ------------------------------- | ---------------------------------------------------- |
| `POST /api/auth/register` | `{ username, email, password }` | 201: `{ id, username, email, createdAt }`; no tokens |
| `POST /api/auth/login`    | `{ email, password }`           | `{ accessToken, refreshToken, expiresIn }`           |
| `POST /api/auth/refresh`  | `{ refreshToken }`              | Same token fields, with a rotated refresh token      |
| `POST /api/auth/logout`   | `{ refreshToken }`              | 204, no body                                         |
| `GET /api/auth/me`        | Bearer access token             | `{ userId, username?, email?, role? }`               |

Registration requires a nonblank username (maximum 100 characters), a valid email (maximum 255 characters), and a nonblank password of 8-100 characters. Confirm password is frontend-only. Duplicate username/email return HTTP 409 with `USERNAME_ALREADY_EXISTS` / `EMAIL_ALREADY_EXISTS`; the UI maps these codes to safe messages. `AuthApi` adapts the .NET failure envelope (`success`, `error`, `traceId`) into the existing `ApiError`, preserving validation details and trace IDs. Other failures use generic UI messages.

`expiresIn` is the access-token lifetime in seconds; the backend configures both access and refresh lifetimes. Refresh expiration is not returned to Angular. JWTs are not decoded by the frontend. Login loads `/me` as the authoritative current-user response.

`AuthSession` keeps tokens and user state **in memory only**, isolated per page/tab. Reloading or closing the page requires signing in again; localStorage and sessionStorage are not used. Neither passwords nor tokens are persisted. This limits persistent token exposure and avoids cross-tab refresh-token rotation races, but JavaScript-accessible tokens remain vulnerable to XSS. Memory storage is **not equivalent to secure HttpOnly cookies**. The session abstraction allows later storage changes without involving feature components. Reloading discards tokens locally; it does not revoke the backend refresh session.

`AuthService` coordinates login, current-user loading, refresh, and logout. The functional interceptor attaches Bearer only to the configured Gateway origin and API path boundary; unrelated URLs receive no session credentials. Register, login, refresh, and logout bypass the interceptor's token/refresh logic through an HTTP context flag (and endpoint exclusion). This prevents recursion while keeping regular Angular HTTP testing and transport. The interceptor depends on `AuthService`, which uses `AuthApi`; token requests exit before resolving `AuthService`, avoiding an injection cycle.

A protected request returning 401 shares one in-flight refresh with other requests, replaces both tokens, and retries at most once. A late 401 from the old access token reuses an already completed rotation. Refresh continues if the initiating page is destroyed so a successful rotation is not lost. Refresh failure or a second 401 clears the local session. There is no timer or background polling. HTTP 403 never refreshes or clears the session. Other errors remain available to the existing safe page error/retry UI; there are no global redirects on HTTP failures.

Logout waits for an active refresh, revokes the latest refresh token, and clears local state even if revocation fails. The UI reports when server sign-out cannot be confirmed. The backend's existing behavior leaves issued access tokens valid until expiration. The flashcard parent and child route guards redirect anonymous navigation to `/login`; they are UX controls, and backend authorization remains authoritative. No frontend role-based Admin UI is introduced.

### Integration verification

With Docker Compose running, start Angular and open Account. Verify invalid credentials show a generic error, successful login opens Flashcards, and levels, lessons, pagination, and details load. Browser Network requests must use the frontend's `/api/**` paths. Use an existing test account; never paste tokens into logs or source files.

Check an expired access token causes one refresh and one retry, including concurrent API requests; a User must receive 403 from an Admin-only endpoint without refresh or logout. Sign out and verify the refresh session is revoked. Reloading the page must require login again. Automated tests cover these client behaviors with mocked HTTP. Live HTTP checks can establish backend routing and rotation, but do not replace browser UI checks.

## Development commands

| Task                     | Command                     |
| ------------------------ | --------------------------- |
| Start development server | `npm start`                 |
| Production build         | `npm run build`             |
| Run tests once           | `npm test -- --watch=false` |
| Watch tests              | `npm test -- --watch=true`  |
| Watch development build  | `npm run watch`             |

## Project structure

```text
src/
  app/
    core/              # Shared API infrastructure and application layout
    features/
      home/            # Landing page
      flashcard/       # Pages, components, models, service, and routes
    app.config.ts      # Application providers
    app.routes.ts      # Top-level routes
  styles.css           # Global styles and Tailwind import
public/                # Static assets
```

The app uses standalone components and lazy-loaded routes. Feature services handle domain data: `JlptLevelService`, `LessonService`, and `FlashcardService` call the shared `ApiClient` through the Gateway.

## Development status

Backend integration covers JLPT levels, lessons, paginated flashcards, and details. Authentication supports registration, login, in-memory sessions, refresh rotation, and header sign-out. Vocabulary management and saved progress are planned. Some sidebar links remain placeholders. Tests cover API response/error handling and the existing feature flows, alongside layout creation checks.

## Contributing

Use `feature/<name>` branches and open PRs targeting `develop`. Follow conventional commit prefixes such as `feat`, `fix`, `refactor`, `style`, `test`, `docs`, and `chore`.

Run tests and a production build before opening a PR. Keep changes focused and add tests when changing behavior.

See [AGENTS.md](AGENTS.md) for detailed architecture, file pointers, coding conventions, and known limitations.
