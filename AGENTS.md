# AGENTS.md

## 1. Project context

- Angular frontend for Japanese Learning: accounts, flashcards, kanji quizzes, and administration.
- Locked versions: Angular 22.1.1, CLI/build 22.1.3, TypeScript 6.0.3; npm 11.12.1 is declared in `package.json`.
- Standalone components, lazy routes, Signals, RxJS, HttpClient, and Tailwind CSS 4; no external state or UI component library.
- Application requests target the Gateway. Quarkus learning APIs use `ApiClient`; .NET authentication uses `AuthApi` with a different response contract.
- Follow user requirements and higher-priority instructions first. Use [README.md](README.md) for setup/deployment; keep this file focused on stable coding rules.

## 2. Repository navigation

- `src/main.ts`, `src/app/app.config.ts`, `src/app/app.routes.ts`: bootstrap, providers, top-level routes.
- `src/app/core/api/`: configuration, HTTP transport, response envelopes, normalized errors.
- `src/app/core/auth/`: in-memory session state, authentication services, guards, interceptor.
- `src/app/core/layout/`: guest, learner, and admin shells and shared navigation.
- `src/app/features/`: `auth/`, `home/`, `flashcard/`, `kanji-quiz/`, `admin/`; inspect the relevant feature first.
- Larger features use `pages/`, `components/`, `services/`, `models/`, and route files. Small features keep files together; do not force a new hierarchy.
- Reusable UI usually lives in feature `components/`; do not invent a global shared directory or move domain logic into `core/` for hypothetical reuse.
- `src/styles.css`, `.postcssrc.json`, `public/`: global Tailwind styles, PostCSS integration, static assets.
- Colocated `*.spec.ts` and feature `testing/` fixtures; `e2e/`, `scripts/`, `docs/` contain quiz browser tests, live runner, and verification records.

## 3. Token-efficient exploration

- Understand the task, identify the smallest feature, then inspect filenames with targeted `rg --files` before reading contents.
- Consult this guide and README for orientation; reuse session context instead of rereading unchanged files.
- Start with the relevant component/template/test or service/model/caller; inspect at most one or two nearby examples before expanding.
- Search specific symbols and read relevant ranges. Avoid dumping large files, repository-wide scans, and repeated commands.
- Exclude `node_modules/`, `.angular/`, `dist/`, `coverage/`, generated output, and lockfiles from routine searches. Read dependency metadata only for a concrete tooling question.
- Batch independent reads where useful; expand only to resolve missing evidence. Never trade correctness, security, or accessibility for fewer tokens.

## 4. Angular and TypeScript conventions

- Follow surrounding names: kebab-case files, descriptive PascalCase classes/types, `app-` selectors; components generally omit `.component`/`Component` suffixes (for example `lesson-list.ts` / `LessonList`).
- Services generally use `*.service.ts` / `*Service`; preserve established names such as `ApiClient`, `AuthApi`, and `AuthSession`. Models use descriptive types without an `I` prefix.
- Use standalone components with explicit template `imports`, `inject()`, signal inputs (`input.required<T>()` where required), and `output<T>()`. Preserve OnPush where used; do not introduce NgModules for routine features.
- Use `@if`, `@for`, `@empty`, and `@switch` as appropriate. Keep complex transformations outside templates.
- Preserve `loadComponent`/`loadChildren`, role boundaries, and unsaved-change guards. Use RouterLink arrays for parameters; validate route values and observe parameter changes when a component remains mounted.
- Type API boundaries explicitly; prefer specific unions and `readonly` contracts. Handle null/undefined intentionally and avoid unsafe assertions.
- `tsconfig.json` enables selected checks, including `noImplicitReturns`, but does not enable full `strict` or `strictTemplates`. Do not weaken checks or enable repository-wide strictness as incidental cleanup.
- Respect `.editorconfig` and `.prettierrc`: UTF-8, two spaces, final newline, single quotes, 100-character print width, Angular HTML parser. Preserve multilingual text.
- Match nearby relative imports and grouping; import order is not uniformly enforced. No ESLint configuration is present. Do not reorder or reformat unrelated code.

## 5. Clean Code and SOLID

- Apply SOLID, DRY, KISS, and YAGNI pragmatically: meaningful names, cohesive methods, clear ownership, guard clauses, and shallow nesting.
- Pages orchestrate routes/state/services; display components handle presentation/interaction; services own reusable feature logic and transport boundaries.
- Prefer composition and Angular DI over unnecessary inheritance/coupling. Introduce constants for meaningful repeated values, not every literal.
- Search before adding a helper, interface, service, or abstraction. Extract only for concrete reuse or responsibility boundaries; no speculative CRUD frameworks or premature optimization.

## 6. Components and reusability

- Search the relevant feature and nearby components before creating UI; reuse existing cards, form actions, sections, and navigation when suitable.
- Preserve signal input/output communication; never mutate inputs or fetch backend data from reusable display components.
- Separate presentation from orchestration when beneficial, without fragmenting simple templates into needless components.
- Keep feature-specific UI local. Do not add a UI library when existing components/Angular suffice; justify any required dependency.

## 7. State and reactivity

- Use local signals for synchronous UI state, `computed()` for derived values, and Observables/RxJS for HTTP and reactive routing. Preserve working patterns rather than converting them wholesale.
- Keep one source of truth and explicit state transitions; use existing discriminated loading/loaded/error states when appropriate, including empty results.
- Use `toSignal` or lifecycle-aware subscriptions (`takeUntilDestroyed`); preserve request cancellation and use `switchMap` for replaceable reads. Avoid nested subscriptions and duplicate requests.
- Do not use cancellation semantics that lose required writes. Preserve intentional auth refresh completion even when its original subscriber is destroyed.
- Avoid unnecessary `effect()` and manually synchronized derived state. Do not introduce NgRx or another global store without an explicit requirement.

## 8. API integration

- Normal flow: page → feature service → `ApiClient` → HttpClient → Gateway. Keep endpoint paths, query/body construction, feature validation, and mapping in services.
- `ApiClient` owns Quarkus envelope validation, timeout, metadata, and `ApiError` normalization. Reuse its types/runtime guards; preserve trace/correlation metadata and avoid a second response wrapper.
- `AuthApi` deliberately uses HttpClient directly for .NET plain success bodies and auth error adaptation; do not force it into the Quarkus envelope.
- `API_CONFIG` in `core/api/api.config.ts` defaults to `/api` and 15 seconds. Feature paths include versions where needed but never repeat `/api`.
- `proxy.conf.json` forwards development requests to the Gateway; production uses `nginx.conf`. No Angular environment-file/runtime loader exists. Use the existing provider boundary for configuration, not hardcoded service hosts.
- Verify contracts in existing services/models or backend evidence; never invent endpoints or payloads. Validate external data at the boundary, not repeatedly in presentation layers.
- Do not add global retries, persistent caching, or duplicate HTTP infrastructure without requirements.

## 9. Authentication and security

- Reuse `AuthService`, `AuthSession`, guards, and `authInterceptor`; preserve registration → login → `/me` identity/role loading.
- Tokens/user state are memory-only. Do not introduce localStorage/sessionStorage token persistence or decode JWTs as an alternative authority.
- Preserve API-origin/path-scoped Bearer attachment, auth-endpoint exclusions, shared 401 refresh, one retry, and session clearing on refresh failure/repeated 401. A 403 must not trigger refresh/logout.
- Preserve logout coordination with rotation, local clearing on failure, role-separated routes, mounted-layout sign-out handling, and allowlisted quiz return URLs.
- Backend authorization is authoritative; never bypass guards or service authorization for convenience. Do not assume cookie/CSRF mechanisms that are not implemented.
- Never embed secrets, log credentials/tokens, expose private diagnostics, or bypass Angular sanitization. Avoid untrusted HTML rendering and preserve existing security headers/boundaries.

## 10. Forms and validation

- Follow the nearest form: auth/vocabulary use `FormsModule` and `ngModel`; quiz editing also uses reactive `FormControl` patterns. Do not migrate styles or add form libraries incidentally.
- Reuse feature validators in `models/` and existing form components; keep constraints aligned with verified API contracts.
- Guard invalid/pending submissions and repeated writes; preserve server field-error mapping, entered values where appropriate, and intentional password clearing.
- Associate labels/help/errors with controls, expose invalid/busy state, and preserve focus on form entry, cancellation, and error recovery.

## 11. UI/UX and styling

- Use existing Tailwind utilities and nearby layouts: gray surfaces/text, indigo actions, rounded bordered panels, responsive spacing, visible focus, and disabled states.
- Reuse feature UI patterns; there is no separate component-library design system. Avoid duplicate utility abstractions, unnecessary inline/custom styles, or unrelated redesign.
- If adding component CSS, attach it through component metadata; an existing sibling stylesheet is not proof that it is loaded.
- Preserve responsive behavior and distinct loading, empty, success, and error feedback; do not treat empty data as a failed request.

## 12. Performance and accessibility

- Preserve lazy loading, suitable list `track` keys, efficient derived state, and subscription cleanup. Avoid expensive template work and repeated requests; optimize only with a concrete need.
- Use semantic HTML, buttons for actions, links for navigation, accessible names, keyboard operation, and visible focus. Preserve contrast and meaningful heading structure.
- Use existing `role="status"`, `role="alert"`, `aria-busy`, and field descriptions when appropriate; avoid redundant ARIA or click-only nonsemantic controls.

## 13. Errors and feedback

- Normalize transport errors centrally; interpret expected feature errors locally with safe messages and relevant recovery/retry actions.
- Reuse inline feedback and feature error helpers; no global toast library is established. Avoid duplicate notifications or silently swallowed failures.
- Preserve validation details/trace metadata internally without displaying raw backend messages or stack traces. Do not add catch blocks that only rethrow unchanged errors.

## 14. Production quality

- Deliver typed, readable, maintainable code that preserves contracts/behavior and handles affected null, invalid, empty, failure, and concurrency cases.
- Keep configuration at established boundaries, dependencies minimal, UI responsive/accessible, and code testable. Do not rely on TypeScript types to validate remote JSON.

## 15. Testing and verification

- Use Angular TestBed, Vitest/jsdom, colocated specs, existing fixtures, and router harnesses. HTTP tests use `provideHttpClient()` before `provideHttpClientTesting()` and verify outstanding requests.
- Add/update deterministic behavior tests for meaningful success, failure, empty, and affected edge cases; mock external dependencies in unit tests. Diagnose failures rather than blindly changing expectations.
- Focused: `npm test -- --watch=false --include=src/app/core/auth/auth.service.spec.ts` (substitute the relevant spec).
- Broader: `npm test -- --watch=false` only for cross-cutting changes or explicit requests; do not repeat the full suite after every edit.
- Production build: `npm run build` when scope warrants; investigate budget failures instead of weakening limits. Skip tests/builds for documentation-only edits unless needed.
- Formatting: `npx --no-install prettier --check <files>`; use `--write` only on relevant files.
- Type checking when needed: `npx --no-install tsc --noEmit -p tsconfig.app.json` and `npx --no-install tsc --noEmit -p tsconfig.spec.json`. These are local tools, not npm scripts; no lint/typecheck script or coverage threshold is configured.
- `npm run test:quiz:live` creates Docker resources; `npm run test:quiz:e2e` writes temporary fixtures to the development stack. Consult [docs/kanji-quiz-integration.md](docs/kanji-quiz-integration.md) before running; ordinary unit tests need no backend.
- Use `npm.cmd` / `npx.cmd` if PowerShell blocks wrappers; do not change execution policy. Never claim an unexecuted check passed.

## 16. Minimal change policy

- Change only task-required files. Preserve unrelated user edits; no incidental refactoring, renaming, formatting, dependency upgrades, configuration changes, or new documentation files.
- Do not change public contracts, routing, auth behavior, or architectural layers without task requirements. Report unrelated defects rather than fixing them automatically.
- Before editing, run `git branch --show-current` and `git status --short`. Do not commit, push, pull, create/switch branches, rebase, reset, clean, stash, discard changes, or open PRs unless explicitly requested.
- Review-only tasks are read-only: inspect the diff first, prioritize concrete regressions, and avoid unnecessary expensive checks.

## 17. Agent workflow

1. Understand requirements and Git state; ask only if ambiguity materially affects correctness, security, contracts, or UX.
2. Locate the smallest feature and nearest implementation; search for reusable code and choose the smallest correct change.
3. Implement within established boundaries; add/update relevant tests without unrelated cleanup.
4. Run focused checks, inspect `git diff --stat` and `git diff`, and confirm only intended files changed with no debug code.
5. Report completed behavior, affected files, actual verification, and unresolved limitations. Completion requires relevant verification or an explicit account of what remains unverified.

## 18. Communication and token efficiency

- Be concise and precise; give meaningful progress updates, not tool-by-tool narration. Do not repeat the request, dump files, or explain basic Angular concepts unless asked.
- Final responses state what changed, files affected, checks/results, and important risks. Show code only when useful; avoid unrelated recommendations.
- Keep this file stable: no route catalogs, historical test counts, feature-status reports, or work logs. Link detailed setup/verification documentation instead.

## 19. Prohibited practices

- No invented project features/contracts, duplicate business logic, unrelated architectural migrations, speculative abstractions, or unjustified `any`.
- No insecure HTML/token handling, secret logging, security bypasses, ignored subscription cleanup, or false verification claims.
- No destructive commands without explicit authorization; never overwrite unrelated work or modify generated output as source.
