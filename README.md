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

All backend requests use `ApiClient` and the single `API_CONFIG` token in `src/app/core/api/api.config.ts`. Its default `baseUrl` is `/api` with a 15-second timeout. Feature paths include their version where required: `v1/jlpt-levels`, `v1/lessons`, and `v1/flashcards`. Unversioned routes such as `auth/login` and `vocabularies` share the same API root; do not repeat `/api` in feature paths.

During development, the existing `proxy.conf.json` forwards only `/api/**` to `http://localhost:8080` (the Gateway), preserving paths. `angular.json` enables this for `npm start`. Browser requests remain same-origin, for example `/api/v1/flashcards`; the proxy forwards them to the Gateway. Restart `npm start` after changing proxy settings. Backend debugging ports must not be used by Angular.

For production, configure the frontend/edge server to forward `/api/**` to the Gateway and serve Angular routes through `index.html`. The development proxy is not included in the production build. No development hostname is bundled into the application. If deployment needs a separate Gateway origin, override `API_CONFIG` in `app.config.ts` with a base such as `https://gateway.example/api` and the timeout; allow only the required frontend origin at the Gateway.

Shared response validation, metadata, timeout, and normalized errors remain in `src/app/core/api/`. HTTP 401 (missing/invalid/expired authentication) and 403 (insufficient permission) retain their distinct status values. Pages currently show safe generic error/retry states; neither status triggers automatic logout or redirects.

There is no login UI, auth API service, token storage, or usable token lifecycle yet. No Authorization interceptor is installed and no Bearer header is fabricated. Protected endpoints require later authentication work, including centralized token access and a Gateway-scoped interceptor. Do not store passwords or log tokens.

To check integration with the stack running, run `npm start`, browse levels, open a lesson, page through its cards, and open a card detail. In browser developer tools, verify requests use `/api/**` on the frontend origin and return backend data through the Gateway. Authentication and authenticated 401/403 UI flows require later manual verification once auth is implemented.

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

Backend integration covers JLPT levels, lessons, paginated flashcards, and details. Authentication, vocabulary management, and saved progress are planned. Some sidebar links remain placeholders. Tests cover API response/error handling and the existing feature flows, alongside layout creation checks.

## Contributing

Use `feature/<name>` branches and open PRs targeting `develop`. Follow conventional commit prefixes such as `feat`, `fix`, `refactor`, `style`, `test`, `docs`, and `chore`.

Run tests and a production build before opening a PR. Keep changes focused and add tests when changing behavior.

See [AGENTS.md](AGENTS.md) for detailed architecture, file pointers, coding conventions, and known limitations.
