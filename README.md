# Japanese Learning — Angular Frontend

Angular frontend for the Japanese Learning application. It provides account registration and sign-in, JLPT vocabulary flashcards, kanji quizzes with results/history/progress, and administration tools for vocabulary, lesson imports, and quiz questions.

This repository is the frontend submodule of a microservices system. The .NET service owns accounts and authentication; Quarkus provides learning APIs. Browser requests use a shared API Gateway root rather than individual service addresses. The frontend proxy configuration expects an HTTP Gateway at port 8080; Gateway implementation and backend deployment are managed outside this submodule.

Admin user-management and settings pages are placeholders. Lesson administration currently provides file import, not a general lesson editor.

## Technology stack and prerequisites

Versions below reflect `package-lock.json`; `npm ci` installs the locked dependencies.

| Technology      | Version / purpose                                                                            |
| --------------- | -------------------------------------------------------------------------------------------- |
| Angular         | 22.1.1 framework; 22.1.3 CLI/build tooling; standalone components, Router, HttpClient, forms |
| TypeScript      | 6.0.3 (package range `~6.0.2`)                                                               |
| RxJS            | 7.8.2; asynchronous requests and reactive routing                                            |
| Angular Signals | Local/derived UI state and in-memory authentication state                                    |
| Tailwind CSS    | 4.3.3, integrated through PostCSS                                                            |
| Vitest / jsdom  | 4.1.10 / 28.1.0; Angular unit and DOM tests                                                  |
| Playwright      | 1.64.0; opt-in Chromium browser integration tests                                            |
| Prettier        | Formatting, including Angular templates                                                      |

Use **Node.js 24.15.0 or newer within 24.x** to align with the Docker build's Node 24 image. The locked Angular packages declare Node support as `^22.22.3 || ^24.15.0 || >=26.0.0`. The repository has no Node version file or application-level `engines` field. `package.json` declares **npm 11.12.1** as its package manager.

You also need access to the API Gateway, .NET authentication service, and Quarkus learning services for authenticated workflows. Docker is optional for frontend-only development and unit tests, but required for the supplied container build and live quiz verification.

## Getting started

Run from this submodule's directory:

```bash
npm ci
npm start
```

Open [http://localhost:4200](http://localhost:4200), the Angular development server's default address. Source changes trigger rebuilding/reloading. No global Angular CLI installation is needed.

Make the backend Gateway available at `http://localhost:8080` before using registration, login, or learning pages. Use the parent repository's backend setup instructions; there is no Compose file in this submodule. Register through `/register`, then sign in through `/login`. Admin access requires an account with the backend-provided `Admin` role; the frontend does not grant roles.

On Windows, use `npm.cmd` and `npx.cmd` if PowerShell blocks the corresponding `.ps1` wrappers.

## Environment configuration

[API_CONFIG](src/app/core/api/api.config.ts) is the application configuration boundary:

```typescript
{ baseUrl: '/api', timeoutMs: 15_000 }
```

The API root includes `/api`; feature services append paths such as `v1/flashcards` or `auth/login`. Do not repeat `/api` in service paths.

- **Development:** [proxy.conf.json](proxy.conf.json), enabled by `angular.json`, forwards `/api/**` to `http://localhost:8080` without removing the path. Restart `npm start` after changing the proxy.
- **Production:** the supplied NGINX configuration forwards `/api` and its descendants to `gateway:8080`. The development proxy is not part of the compiled application.
- **Different API origin:** override the `API_CONFIG` provider in [app.config.ts](src/app/app.config.ts), supplying both `baseUrl` and `timeoutMs`. Cross-origin deployments also require appropriate Gateway CORS configuration. This is a source/build-time change.

There are no Angular environment files, environment file replacements, `.env` loader, or runtime API configuration loader. Application configuration is bundled into public browser assets; do not put secrets in it. Quiz test environment variables described below configure test runners only.

## Project structure

```text
src/
  main.ts                     # Standalone application bootstrap
  app/
    app.config.ts             # Router, HTTP interceptor, error-listener providers
    app.routes.ts             # Guest, learner, and admin route boundaries
    core/
      api/                    # API configuration, envelopes, validation, errors
      auth/                   # Session, auth transport, guards, interceptor
      layout/                 # Guest, learner, admin layouts and navigation
    features/
      auth/                   # Guest landing, login, registration
      home/                   # Authenticated home page
      flashcard/              # JLPT levels, lessons, study, card details
      kanji-quiz/              # Setup, gameplay, results, history, progress
      admin/                  # Vocabulary, imports, quiz question management
  styles.css                  # Global styles and Tailwind import
public/                       # Static assets copied by the build
scripts/                      # Isolated live quiz verification runner
e2e/                         # Playwright tests and development-stack fixtures
docs/                        # Quiz integration and security review records
```

Feature folders organize pages, display components, models, and services as needed. Keep application-wide infrastructure in `core/` and domain logic in its feature. See [AGENTS.md](AGENTS.md) for repository conventions.

## Application architecture

`main.ts` bootstraps the standalone `App` component with `appConfig`. Providers register Angular Router, HttpClient with the functional authentication interceptor, and browser error listeners.

Routes use `loadComponent` and `loadChildren` for lazy loading. Guest pages include `/`, `/login`, and `/register`. Authenticated learner routes include `/flashcards` and `/kanji-quiz`; administration lives under `/admin`. Parent and child guards separate learner and admin areas. Unknown routes redirect to `/`.

The normal data flow is:

```text
Page → feature service → ApiClient → HttpClient → Gateway
```

Pages coordinate route parameters, requests, and loading/error/empty states. Display components receive inputs and emit interactions. Services use Angular dependency injection and typed models with runtime response validation. Existing components use signals/computed values and OnPush change detection; asynchronous flows use RxJS, `toSignal`, and lifecycle-aware subscriptions. Reactive route flows use `switchMap` to replace stale requests. There is no external global state-management library.

Use the nearest existing feature as a pattern: preserve lazy loading, service-owned API access, semantic controls, accessible form feedback, and focused tests. Formatting uses two-space indentation, single-quoted TypeScript strings, a 100-character print width, and the Prettier Angular HTML parser.

## Authentication and authorization

[AuthApi](src/app/core/auth/auth-api.service.ts) calls these Gateway endpoints using the plain JSON response contract expected from .NET:

| Method / path             | Purpose                                                                     |
| ------------------------- | --------------------------------------------------------------------------- |
| `POST /api/auth/register` | Submit username, email, password; create an account without signing in      |
| `POST /api/auth/login`    | Submit email/password; receive access token, refresh token, and `expiresIn` |
| `GET /api/auth/me`        | Load the authoritative user identity and role using the access token        |
| `POST /api/auth/refresh`  | Exchange the refresh token for replacement tokens                           |
| `POST /api/auth/logout`   | Submit the refresh token for server-side revocation                         |

Registration returns to login. Login loads `/me`, then normally routes Admin users to `/admin` and learners to `/flashcards`. Only validated quiz session/result return URLs can survive sign-in; arbitrary redirect URLs are not accepted.

`AuthSession` stores tokens and user state **in memory only**. Reloading or closing the page requires signing in again; tokens are not stored in localStorage/sessionStorage. Reloading discards the local session without revoking it on the server. The frontend does not decode JWTs or run a refresh timer.

The interceptor attaches Bearer credentials only within the configured API origin and path boundary. Register/login/refresh/logout bypass its token and refresh logic. An authenticated request receiving HTTP 401 shares a single in-flight refresh and retries once. Refresh failure or a second 401 clears the session; 403 does not trigger refresh or sign-out. Logout coordinates with pending refresh, attempts revocation, and clears local state even on failure.

Guards use the `/me` role to separate Admin and learner navigation. Authenticated layouts also redirect to login when the session ends. These are UI controls; backend authorization remains authoritative. Account administration and settings routes currently show coming-soon content.

## Backend API integration

[ApiClient](src/app/core/api/api-client.service.ts) owns HTTP transport, the configured timeout, Quarkus response-envelope validation, and normalized `ApiError` handling. Success responses retain `data` and `meta` (including trace/correlation identifiers). Feature services supply endpoint paths, request bodies/query parameters, payload guards, and domain mapping.

Current API families, relative to `/api`, include:

| Paths                                           | Frontend usage                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `v1/jlpt-levels`, `v1/lessons`, `v1/flashcards` | Level/lesson browsing, paginated cards and details                  |
| `v1/admin/vocabularies/...`                     | Vocabulary content and metadata updates; reads reuse flashcard APIs |
| `vocabularies/import`, `v1/lessons/batch`       | Multipart JSON file imports                                         |
| `v1/kanji-quiz/...`                             | Configuration, sessions, answers, completion, history, progress     |
| `v1/admin/kanji-quiz/questions/...`             | Question bank, editing, publication, archival, import               |
| `auth/...`                                      | .NET authentication via `AuthApi`                                   |

`AuthApi` uses HttpClient directly because .NET success bodies do not use the Quarkus envelope. It still shares API configuration, timeout, validation, and error normalization. Both transport paths target the Gateway; application services do not call individual backend hosts directly. The isolated live test harness deliberately uses its temporary Quarkus address instead.

## Available commands

| Command                     | Purpose                                                                |
| --------------------------- | ---------------------------------------------------------------------- |
| `npm start`                 | Development server with the API proxy                                  |
| `npm run build`             | Production build (default build configuration)                         |
| `npm run watch`             | Watch/rebuild using development configuration; does not start a server |
| `npm test -- --watch=false` | Run unit tests once                                                    |
| `npm test -- --watch=true`  | Watch unit tests                                                       |
| `npm run test:quiz:live`    | Isolated live Quarkus/MySQL integration verification                   |
| `npm run test:quiz:e2e`     | Playwright tests against the configured development stack              |
| `npm run ng -- <arguments>` | Invoke the local Angular CLI                                           |

There are no lint or formatting npm scripts. Prettier is installed and configured; check or format only relevant files:

```bash
npx --no-install prettier --check README.md
npx --no-install prettier --write README.md
```

## Testing

The `@angular/build:unit-test` builder runs Vitest with jsdom. `tsconfig.spec.json` includes colocated `src/**/*.spec.ts` tests and Vitest globals. Tests use Angular TestBed, HTTP testing utilities, and router harnesses. Ordinary unit runs skip the opt-in live quiz suite and do not require backend services. No coverage reporting or threshold is configured.

Run the smallest relevant test set while developing:

```bash
npm test -- --watch=false --include=src/app/core/auth/auth.service.spec.ts
```

Run the full unit suite before broader integration changes:

```bash
npm test -- --watch=false
```

### Live and browser quiz tests

`npm run test:quiz:live` requires Docker Desktop with Linux containers and the sibling `../quarkus` checkout. It builds Quarkus, creates isolated MySQL/backend containers and temporary signing keys, runs Angular integration tests, and cleans up its own resources. It does not verify the .NET/Gateway browser flow. Do not manually set the internal `KANJI_QUIZ_ISOLATED_TEST` configuration.

Playwright uses `http://127.0.0.1:8088` and does not start the application. Its fixtures require the existing `jp_learning_dev` Compose stack with healthy `frontend`, `gateway`, `user-api`, `vocabulary-api`, `mysql`, and `sqlserver` containers. These tests create temporary accounts and learning data in that development stack and attempt targeted cleanup.

With that stack and an installed Chrome browser, run in PowerShell:

```powershell
$env:QUIZ_E2E_PROJECT = 'jp_learning_dev'
$env:QUIZ_E2E_BROWSER_CHANNEL = 'chrome'
npm.cmd run test:quiz:e2e
```

Without a browser channel override, Playwright expects its Chromium browser to be installed. The natural token-expiration test is skipped unless `QUIZ_E2E_EXPIRY=1`; it can run for up to 25 minutes. Traces, screenshots, and videos are disabled in the supplied configuration.

See [quiz integration verification](docs/kanji-quiz-integration.md) for setup constraints, fixture lifecycle, and historical verification results, and the [quiz security review](docs/kanji-quiz-security-review.md) for its reviewed scope. Historical records are not a guarantee that the current checkout or local stack passes.

## Build and deployment

```bash
npm run build
```

The production browser output is `dist/japanese-learning/browser/`. Production enables output hashing and enforces bundle budgets: initial bundle warning/error at 500 kB/1 MB and component stylesheet warning/error at 4 kB/8 kB. Development disables optimization and license extraction and enables source maps.

For static hosting, serve the browser output, fall back to `index.html` for Angular routes, and proxy `/api` to the Gateway. No server-side rendering target is configured.

The supplied [Dockerfile](Dockerfile) uses digest-pinned Node 24 and NGINX images, installs with `npm ci`, builds production assets, and serves them as non-root UID/GID 101 on container port 8080:

```bash
docker build -t japanese-learning-frontend .
```

[nginx.conf](nginx.conf) provides SPA fallback, `/health`, and API forwarding to `gateway:8080` using Docker DNS. Run the image on a Docker network where that Gateway hostname resolves; map a host port to container port 8080 through the parent deployment configuration. `/health` checks the frontend process, not backend readiness. No standalone Compose configuration is provided here.

## Troubleshooting

- **Node compatibility errors:** check `node --version` against the requirements above, then use `npm ci` with the committed lockfile.
- **PowerShell blocks npm/npx:** use `npm.cmd` / `npx.cmd`; changing execution policy is unnecessary.
- **API requests fail locally:** confirm the Gateway is reachable on port 8080 and requests use `/api/...`. Restart the development server after proxy changes. Starting Angular alone does not start backend services.
- **Sign-in disappears after reload:** this is expected with memory-only authentication.
- **Production deep links return 404:** configure the host's SPA fallback. The supplied NGINX configuration already falls back to `index.html` for application routes.
- **Quiz browser tests refuse to start:** verify the explicit project opt-in, required healthy development containers, and browser installation/channel. See the linked integration guide rather than running these fixtures against another environment.
