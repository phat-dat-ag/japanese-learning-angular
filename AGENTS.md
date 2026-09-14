# AGENTS.md

Repository guide for AI coding agents. Applies to this Angular workspace and its descendants unless a more specific AGENTS.md applies. Follow the user's task and higher-priority instructions first.

## Start here: minimize repeated exploration

- Read this guide once per session, then open only files relevant to the task. Do not reread the whole source tree or README for routine changes.
- Run `git status --short` before editing; preserve unrelated user changes.
- Use the task-to-file table below. Read a component's TypeScript and HTML together; read CSS only if it is attached or relevant.
- Use scoped `rg` searches. Avoid dumping `package-lock.json`, `node_modules/`, `.angular/`, or generated output. Inspect installed package metadata only for a specific tooling question.
- This is a source-derived snapshot, not a substitute for the files being edited. Verify relevant details locally when they conflict with this guide.
- Keep changes focused. Do not automatically fix the known limitations listed below.
- Update affected sections of this guide when changing architecture, commands, routes, data contracts, or documented limitations. Keep it a navigation reference, not a chronological work log.

## Project and tooling

Japanese Learning is a browser Angular application with a shared layout, a minimal home page, and a flashcard learning feature. The current frontend uses in-memory sample data. Authentication, backend integration, vocabulary management, and persistent learning progress are planned, not implemented here. There is no backend implementation or API contract in this workspace.

Declared tooling in `package.json`:
- Angular 22.1.x; Angular CLI/build 22.1.x.
- TypeScript ~6.0.2, RxJS ~7.8.0.
- Tailwind CSS 4.1.x through PostCSS.
- Vitest 4.0.x and jsdom 28.x.
- npm is the package manager; `packageManager` specifies npm@11.12.1. README prerequisites are Node.js 24.x and npm 11.x. Exact resolved dependencies live in `package-lock.json`.

Run commands from the directory containing `package.json` and `angular.json`:

| Task | Command / notes |
| --- | --- |
| Install locked dependencies | `npm ci` when dependency installation is needed |
| Start development server | `npm start`; default URL `http://localhost:4200` |
| Production build | `npm run build` |
| Development build | `npm run build -- --configuration development` |
| Watch development build | `npm run watch` |
| Run tests once | `npm test -- --watch=false` |
| Run one test file | `npm test -- --watch=false --include=src/app/app.spec.ts` |
| Interactive test command | `npm test`; explicitly disable watch for unattended checks |
| Check formatting of selected files | `npx --no-install prettier --check <files>` |
| Format selected files | `npx --no-install prettier --write <files>` |

There is no lint script, ESLint configuration, end-to-end test setup, or custom Vitest configuration in the current tree. Use Angular's test builder rather than assuming a direct Vitest invocation handles Angular compilation. Its default runner is Vitest, using jsdom when no browsers are configured.

## Architecture and file map

Paths are relative to this workspace. Component folders normally contain matching `.ts`, `.html`, and empty `.css` files; only some currently contain `.spec.ts`.

| Task / concern | Start with |
| --- | --- |
| Bootstrap and application providers | `src/main.ts`, `src/app/app.config.ts` |
| Root outlet and application routing | `src/app/app.ts`, `src/app/app.html`, `src/app/app.routes.ts` |
| Shell and sidebar visibility | `src/app/core/layout/main-layout/main-layout.ts` and `.html` |
| Header, profile placeholder, toggle event | `src/app/core/layout/header/header.ts` and `.html` |
| Navigation links and active styles | `src/app/core/layout/sidebar/sidebar.html` and `.ts` |
| Footer | `src/app/core/layout/footer/footer.html` |
| Home page | `src/app/features/home/home.ts` and `.html` |
| Flashcard URLs | `src/app/features/flashcard/flashcard.routes.ts` |
| Level selection | `src/app/features/flashcard/pages/level-list/`, `components/level-card/` within the same feature |
| Lesson selection | `src/app/features/flashcard/pages/lesson-list/`, `components/lesson-card/` within the same feature |
| Study sequencing and progress | `src/app/features/flashcard/pages/study/study.ts` and `.html` |
| Individual card display and reveal | `src/app/features/flashcard/components/flashcard/flashcard.ts` and `.html` |
| Sample data and retrieval | `src/app/features/flashcard/services/flashcard.service.ts` |
| Domain types | `src/app/features/flashcard/models/` |
| Global styles and Tailwind integration | `src/styles.css`, `.postcssrc.json` |
| Document title, base URL, favicon | `src/index.html`, `public/favicon.ico` |
| Build, test, compiler settings | `angular.json`, `tsconfig*.json`, `package.json` |

Execution flow:
1. `src/main.ts` calls `bootstrapApplication(App, appConfig)`.
2. `app.config.ts` provides browser global error listeners and `provideRouter(routes)`. No HTTP client provider is currently registered.
3. `App` renders only a router outlet.
4. The empty-path route lazily loads `MainLayout`; its child outlet hosts Home and flashcard pages.
5. `MainLayout` renders Header, an optional Sidebar, the child outlet, and Footer. Its `isSidebarOpen` signal starts true. Header's `toggleSidebarFromHeader` output calls the layout's `toggleSidebar()`.

Keep application-wide layout in `core/layout/`. Put feature pages, UI components, models, service logic, and route definitions inside `features/<feature>/`. There are no NgModules or shared state libraries in the current implementation.

## Routing contract

| URL | Component / behavior |
| --- | --- |
| `/` | `Home` inside `MainLayout` |
| `/flashcards` | `LevelList` |
| `/flashcards/:level` | `LessonList` |
| `/flashcards/:level/lessons/:lessonId` | `Study` |
| Unmatched URL | Root wildcard redirects to `/` |

The root router lazy-loads `FLASHCARD_ROUTES`; feature pages use `loadComponent`. Preserve this lazy-loading pattern when adding routes.

Level URL parameters are lowercase IDs such as `n5`; display codes are uppercase such as `N5`. Lesson IDs look like `n5-lesson-01`. A populated study URL is `/flashcards/n5/lessons/n5-lesson-01`.

Both LessonList and Study read `ActivatedRoute.snapshot.paramMap` once during instance initialization. This does not react to parameter changes if Angular reuses the same component instance. Account for this when implementing navigation between levels or lessons without leaving the page type.

## Flashcard data and state

All paths below are under `src/app/features/flashcard/`.

Models:
- `models/flashcard-level.model.ts`: `FlashcardLevelCode = 'N1' | 'N2' | 'N3' | 'N4' | 'N5'`; `FlashcardLevel` has `id, code, name, description, lessonCount`.
- `models/flashcard-lesson.model.ts`: `FlashcardLesson` has `id, levelId, lessonNumber, title, description, vocabularyCount`.
- `models/flashcard.model.ts`: `Flashcard` has required `id, lessonId, word, reading, meaning`; optional `exampleSentence, exampleTranslation, audioUrl`.

`FlashcardService` is root-provided and synchronous:
- `getLevels(): FlashcardLevel[]`
- `getLevelById(levelId): FlashcardLevel | undefined`
- `getLessonsByLevel(levelId): FlashcardLesson[]`
- `getLessonById(lessonId): FlashcardLesson | undefined`
- `getFlashcardsByLesson(lessonId): Flashcard[]`

No HTTP, Observable fetching, loading state, or persistence is implemented. Returned objects refer to the service's sample objects; avoid mutating them from display components.

Current sample data includes five levels (N5 through N1), three N5 lessons, and three cards belonging only to `n5-lesson-01`. Displayed lesson/vocabulary counts are sample metadata and do not match actual array lengths. Japanese words/readings, English meanings, and Vietnamese example translations coexist intentionally in the source.

Page/component responsibilities:
- `LevelList` retrieves levels and passes each to LevelCard's required `level` signal input.
- `LessonList` retrieves a level and its lessons; LessonCard takes required `lesson` and `levelId` inputs and builds the study link.
- `Study` retrieves level, lesson, and cards. `currentIndex` starts at zero; `currentCard` and `progress` are computed signals. Progress is `(index + 1) / cardCount * 100`, or zero for an empty deck. `nextCard()` stops at the last card.
- The Flashcard UI component takes required `card` input. Its local `revealed` signal starts false; `reveal()` sets it true and emits `revealedChange(true)`. The template always shows word/reading and conditionally shows meaning/examples.
- The component class and domain interface are both named `Flashcard`; the component imports the interface as `FlashcardModel`.

## Implementation conventions

- Use standalone components with explicit template dependencies in `imports`. Current decorators omit `standalone: true`; do not introduce NgModules for routine additions.
- Match existing naming: `study.ts`, `Study`, selector `app-study`; service/model files retain `.service.ts` / `.model.ts` suffixes.
- Prefer existing Angular patterns: `inject()`, `signal()`, `computed()`, `input.required<T>()`, and `output<T>()`.
- Use `@if`, `@for (...; track item.id)`, and `@empty` in templates. Keep domain retrieval in services and route orchestration in pages.
- Use RouterLink arrays for parameterized internal links; import RouterLink in the consuming component.
- Type model/service boundaries and handle absent lookup results and empty arrays. Do not introduce global compiler strictness changes incidentally: the current configs enable selected checks, but do not explicitly enable `strict` or `strictTemplates`.
- Styling is predominantly Tailwind utilities in HTML: gray surfaces, indigo accents, rounded cards, subtle borders/shadows, and responsive breakpoints. Global CSS imports `tailwindcss`; PostCSS uses `@tailwindcss/postcss`. There is no Tailwind config file.
- Existing component CSS files are empty. Most decorators do not attach them. If adding local CSS, wire it through `styleUrl`; simply editing an unattached file has no effect.
- Preserve semantic buttons/links and accessible labels when editing interactions.
- Formatting: UTF-8, two spaces, final newline, single quotes in TypeScript; Prettier print width 100 and Angular HTML parser. Some existing files differ; avoid unrelated formatting churn.
- In Windows PowerShell, read multilingual files with `Get-Content -Encoding utf8`. Do not mistake terminal decoding artifacts for corrupt source.

## Known limitations to consider when relevant

These are source observations, not a request to fix them on every task.

- Revealing a card does not reset `revealed` when Study supplies the next card to the same child instance. Study does not consume `revealedChange`, and Next does not require reveal.
- Empty study decks show an empty-state message and zero progress, but the counter still renders `1 / 0`.
- Lesson lookup uses only lesson ID; Study does not validate that the selected lesson belongs to the URL's level.
- Invalid level/lesson parameters have no dedicated error route. LessonList falls back to an empty list, while Study can show missing metadata or an empty deck.
- Sidebar links to `/lessons`, `/vocabulary`, `/grammar`, and `/kanji` have no routes and fall through to Home. Daily Practice and Progress use `href="#"`.
- Flashcards navigation uses exact active matching, so it is not marked active on nested lesson/study URLs.
- Header streak/user details are static. `navigateToProfile()` only logs to the console.
- No audio playback, previous-card action, completion flow, spaced repetition, or saved progress currently exists.

## Validation and delivery

- For behavior changes, add or update focused tests and run them with the Angular test command. Before a PR, README calls for tests and a production build; use `npm test -- --watch=false` and `npm run build`.
- Existing specs cover App, Home, Header, Sidebar, Footer, and MainLayout, and only assert creation. Flashcard pages/components/service currently have no tests. Do not infer behavioral coverage from those smoke tests.
- Tests use Angular TestBed with standalone components in `imports`, Vitest globals, and `fixture.whenStable()`. Provide router dependencies (e.g. `provideRouter([])`) when a tested component requires routing. Set required signal inputs through `fixture.componentRef.setInput(...)` before rendering.
- Relevant flashcard checks include reveal behavior across card changes, index bounds, empty decks, missing IDs, and route parameter changes. Test changed behavior rather than duplicating implementation details.
- For UI changes, manually check the populated N5 study URL, N4's empty lesson list, N5 lesson 02's empty deck, back links, sidebar toggle, and narrow viewport behavior as applicable.
- Production budgets: initial bundle warning 500 kB/error 1 MB; individual component styles warning 4 kB/error 8 kB. Investigate budget failures rather than raising limits automatically.
- Documentation-only changes need path/content review and a diff check; do not run builds or add tests solely for prose.
- Report what changed, checks actually run, and any remaining blocker. Do not claim an unrun build or test passed.
- README describes feature branches named `feature/<name>`, PRs targeting `develop`, and conventional commit prefixes (`feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`). Follow the requested Git scope; do not automatically switch branches, commit, or push.
