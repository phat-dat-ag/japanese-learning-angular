# Japanese Learning

An Angular frontend for learning Japanese through JLPT levels, lessons, and vocabulary flashcards.

## Features

- Browse JLPT levels from N5 to N1 and view their lessons.
- Study vocabulary with Japanese words, readings, meanings, and example sentences.
- Reveal card answers and move through a lesson with a progress indicator.
- Navigate through a shared header, collapsible sidebar, and footer.

JLPT levels are loaded from the Quarkus API. Lessons and study cards still use local sample data: three N5 lessons, with three cards in the first lesson. Counts shown on lesson pages are placeholder metadata.

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

Start Quarkus on `http://localhost:8080`, then go to **Flashcards → N5 → Lesson 1** to try the sample deck.

## API configuration

The level list calls `GET /api/v1/jlpt-levels`. During development, `proxy.conf.json` forwards `/api/**` to `http://localhost:8080`, avoiding cross-origin requests from the browser. Restart `npm start` after changing proxy settings.

Shared API types, runtime response validation, and error handling live in `src/app/core/api/`. `API_CONFIG` sets the base URL and a 15-second timeout. The level list provides loading, empty, error, and retry states.

For production, configure the web server to proxy `/api/**` to Quarkus and serve Angular routes through `index.html`. The development proxy is not included in the production build. For a separate API origin, override `API_CONFIG` in `app.config.ts` and configure backend CORS for the frontend origin. Use HTTPS in production.

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

The app uses standalone components and lazy-loaded routes. Feature services handle domain data: `JlptLevelService` loads backend levels, while `FlashcardService` supplies sample lessons and study cards.

## Development status

Backend integration currently covers JLPT levels. Authentication, lesson/card API integration, vocabulary management, and saved progress are planned. Some sidebar links remain placeholders. Tests cover API response/error handling and the level-list flow, alongside layout creation checks.

## Contributing

Use `feature/<name>` branches and open PRs targeting `develop`. Follow conventional commit prefixes such as `feat`, `fix`, `refactor`, `style`, `test`, `docs`, and `chore`.

Run tests and a production build before opening a PR. Keep changes focused and add tests when changing behavior.

See [AGENTS.md](AGENTS.md) for detailed architecture, file pointers, coding conventions, and known limitations.
