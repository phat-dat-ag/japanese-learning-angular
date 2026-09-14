# Japanese Learning

An Angular frontend for learning Japanese through JLPT levels, lessons, and vocabulary flashcards.

## Features

- Browse JLPT levels from N5 to N1 and view their lessons.
- Study vocabulary with Japanese words, readings, meanings, and example sentences.
- Reveal card answers and move through a lesson with a progress indicator.
- Navigate through a shared header, collapsible sidebar, and footer.

The app currently uses local sample data: three N5 lessons, with three flashcards in the first lesson. Other levels have no lessons yet. Displayed vocabulary and lesson counts are placeholder metadata.

## Tech stack

| Technology | Purpose |
| --- | --- |
| Angular 22 and TypeScript 6 | Application and routing |
| Tailwind CSS 4 | Styling |
| RxJS 7 | Reactive utilities |
| Vitest 4 and jsdom | Unit testing |

## Getting started

Install Node.js 24.x and npm 11.x, then run these commands from the directory containing `package.json`:

```bash
npm ci
npm start
```

Open [localhost:4200](http://localhost:4200). The development server reloads when source files change.

To try the sample deck, go to **Flashcards → N5 → Lesson 1**.

## Development commands

| Task | Command |
| --- | --- |
| Start development server | `npm start` |
| Production build | `npm run build` |
| Run tests once | `npm test -- --watch=false` |
| Watch tests | `npm test -- --watch=true` |
| Watch development build | `npm run watch` |

## Project structure

```text
src/
  app/
    core/layout/       # Header, sidebar, footer, and main layout
    features/
      home/            # Landing page
      flashcard/       # Pages, components, models, service, and routes
    app.config.ts      # Application providers
    app.routes.ts      # Top-level routes
  styles.css           # Global styles and Tailwind import
public/                # Static assets
```

The app uses standalone components and lazy-loaded routes. Each feature keeps its UI and data logic together; flashcard sample data lives in `src/app/features/flashcard/services/flashcard.service.ts`.

## Development status

The flashcard flow is an early prototype. Authentication, backend integration, vocabulary management, and saved learning progress are planned. Some sidebar links are placeholders, and existing unit tests mainly check component creation.

## Contributing

Use `feature/<name>` branches and open PRs targeting `develop`. Follow conventional commit prefixes such as `feat`, `fix`, `refactor`, `style`, `test`, `docs`, and `chore`.

Run tests and a production build before opening a PR. Keep changes focused and add tests when changing behavior.

See [AGENTS.md](AGENTS.md) for detailed architecture, file pointers, coding conventions, and known limitations.
