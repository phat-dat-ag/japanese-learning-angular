# AGENTS.md

## Project Overview

This repository contains the Angular frontend for the Japanese Learning application.

The application communicates with the Quarkus backend and follows modern Angular standalone and reactive patterns.

Primary goals for all changes:

- Correctness
- Clean Code
- SOLID principles where appropriate
- Readability and maintainability
- Strong typing
- Accessibility
- Consistency with existing architecture
- Minimal and focused changes
- Efficient repository exploration

Follow the user's task and higher-priority instructions first.

---

## Tech Stack

- Angular 22
- TypeScript 6
- RxJS
- Angular Signals
- Angular Router
- Angular HttpClient
- Tailwind CSS 4
- Vitest / jsdom
- npm

Do not introduce alternative frameworks, state-management libraries, UI libraries, or dependencies when Angular or the existing project already provides sufficient functionality.

---

## Architecture

Follow the existing project structure and conventions.

Typical flow:

```text
Page / Component
      ↓
Feature Service
      ↓
ApiClient
      ↓
Quarkus Backend
```

Responsibilities:

- Page: route orchestration, page state, feature composition
- Component: presentation, interaction, local UI state
- Feature Service: feature logic, API calls, payload validation/mapping
- ApiClient: HTTP transport, response envelope, timeout, normalized errors
- Model / DTO: typed contracts

Rules:

- Keep components focused on UI responsibilities.
- Keep backend/API access in services.
- Keep shared HTTP concerns in `core/api/`.
- Keep page-level orchestration in feature pages.
- Do not introduce new architectural layers unless clearly required.
- Do not introduce NgModules for routine features.
- Preserve lazy loading.
- Prefer existing project patterns over introducing new ones.

---

## Project Structure

Keep application-wide concerns under:

```text
src/app/core/
```

Keep feature-specific code under:

```text
src/app/features/<feature>/
```

Typical feature structure:

```text
components/
pages/
services/
models/
*.routes.ts
```

Shared API infrastructure belongs in:

```text
src/app/core/api/
```

Application layout belongs in:

```text
src/app/core/layout/
```

Do not move feature logic into `core/` based only on hypothetical future reuse.

Do not create generic shared abstractions without actual reuse.

---

## Clean Code and SOLID

All new or modified code must be:

- readable
- simple
- maintainable
- testable
- strongly typed
- focused
- easy to understand

Apply SOLID pragmatically.

Rules:

- A component, service, class, or method should have one clear responsibility.
- Keep methods focused and reasonably small.
- Use clear and descriptive names.
- Prefer early returns when they reduce nesting.
- Avoid deeply nested logic.
- Avoid duplicated logic.
- Avoid magic values when constants or typed values are appropriate.
- Avoid `any` unless genuinely necessary.
- Avoid unsafe type assertions.
- Keep interfaces and models focused.
- Keep templates readable.
- Move complex logic out of templates.
- Prefer straightforward code over clever code.
- Avoid unnecessary comments; comment intent or constraints, not obvious code.
- Avoid premature abstraction.
- Avoid speculative functionality.
- Do not over-engineer simple behavior.
- Refactor only when it directly supports the requested task.

Do not split simple code into unnecessary layers merely to satisfy theoretical SOLID rules.

Code should be understandable by another developer without extensive explanation.

---

## Existing Code Is the Source of Truth

When implementation details are not explicitly specified:

1. Find the closest existing implementation.
2. Inspect one or two similar examples.
3. Follow existing conventions.
4. Reuse existing components before creating new ones.

Before creating a new:

- service
- model / DTO
- component / page
- pipe / directive
- helper
- error type
- API wrapper
- state abstraction

search for an existing equivalent first.

Prefer actual repository code over assumptions.

If this guide conflicts with current implementation, verify the relevant source code before making a broad change.

---

## Angular Conventions

Use modern Angular patterns already present in the project.

Prefer:

```typescript
inject()
signal()
computed()
input.required<T>()
output<T>()
```

Use modern template control flow:

```html
@if (...) {
}

@for (item of items; track item.id) {
}

@empty {
}
```

Rules:

- Use standalone components.
- Keep template dependencies explicit in `imports`.
- Do not introduce NgModules for routine additions.
- Use signals for appropriate synchronous UI state.
- Use `computed()` for derived state.
- Avoid redundant state.
- Avoid unnecessary `effect()`.
- Preserve `OnPush` where currently used.
- Use Angular dependency injection instead of manual service construction.
- Do not convert working RxJS flows to signals or vice versa without a concrete reason.

---

## TypeScript

Keep TypeScript strongly typed.

Rules:

- Avoid `any`.
- Prefer specific types and unions.
- Type API and service boundaries explicitly.
- Handle `undefined` and missing results intentionally.
- Avoid unsafe type assertions.
- Avoid broad `object`, `Function`, or loosely typed dictionaries without reason.
- Reuse existing models instead of duplicating them.
- Separate transport DTOs from UI/domain models only when they genuinely differ.
- Use `readonly` where consistent with existing immutable contracts.

Do not introduce repository-wide compiler configuration changes as part of an unrelated task.

---

## Components and Pages

Components should focus on presentation and interaction.

Rules:

- Keep components small and understandable.
- Use required signal inputs where appropriate.
- Use outputs for explicit child-to-parent communication.
- Do not fetch backend data directly from reusable display components.
- Do not mutate inputs.
- Avoid storing values that can be derived.
- Keep complex transformations out of templates.
- Keep local state local unless it genuinely needs to be shared.

Feature pages may coordinate:

- route parameters
- services
- loading/error/empty states
- page-level state
- child components

Do not let pages become containers for unrelated logic.

---

## State Management

Use the smallest appropriate mechanism:

```text
Local UI state       -> signal
Derived state        -> computed
Async HTTP flow      -> Observable / RxJS
Shared feature state -> focused service when needed
```

Rules:

- Prefer one source of truth.
- Avoid redundant state.
- Avoid unnecessary `effect()`.
- Keep state transitions explicit.
- Do not introduce NgRx or another global state library unless explicitly required.

---

## RxJS

Use RxJS deliberately.

Rules:

- Avoid nested subscriptions.
- Prefer operator composition.
- Preserve request cancellation when relevant.
- Use `switchMap` when stale requests should be replaced.
- Avoid manual subscriptions when Angular/template/signal integration can manage lifecycle safely.
- Avoid unnecessary operators.
- Avoid difficult-to-read operator chains.
- Handle errors where they can be meaningfully interpreted.

Follow nearby implementations before introducing a new reactive pattern.

---

## Routing

Preserve existing lazy-loading and `loadComponent` patterns.

Rules:

- Use RouterLink arrays for parameterized internal navigation.
- Avoid manual URL concatenation when router APIs provide a safer option.
- Handle invalid/missing route parameters intentionally.
- Do not assume `ActivatedRoute.snapshot.paramMap` reacts to parameter changes.
- Use reactive route APIs when the same component may remain mounted while parameters change.

Do not hardcode current route structures into new abstractions when existing route definitions can be inspected directly.

---

## API Integration

Use the existing API architecture:

```text
Component / Page
      ↓
Feature Service
      ↓
ApiClient
      ↓
Backend
```

`ApiClient` owns common transport concerns such as:

- HTTP transport
- timeout
- API envelope validation
- normalized errors
- response metadata

Feature services own:

- endpoint paths
- query parameters
- request payloads
- feature payload validation
- feature-specific mapping

Rules:

- Do not make direct `HttpClient` calls from components when the existing API abstraction should be used.
- Do not duplicate `ApiClient` responsibilities in feature services.
- Do not introduce another API response wrapper.
- Reuse existing response types and runtime guards.
- Preserve backend metadata and normalized errors.
- Validate external data at appropriate boundaries.
- Do not trust API data merely because TypeScript types compile.
- Do not introduce generic CRUD abstractions without a concrete use case.
- Do not add global retries or persistent caching unless explicitly required.

---

## API Configuration

Use existing API configuration and proxy infrastructure.

Do not hardcode development backend URLs into production application code.

Development currently uses the project proxy configuration for `/api/**`.

When configuration behavior matters, inspect:

```text
src/app/core/api/
proxy.conf.json
```

Production API origins must use the project's deployment/configuration strategy rather than hardcoded localhost values.

---

## Validation and Error Handling

Validate data at the appropriate boundary.

Possible validation areas:

- user input
- route parameters
- API response envelopes
- feature payloads

Rules:

- Do not duplicate validation across layers.
- Keep feature payload validation in the relevant service/API boundary.
- Normalize transport errors through existing API infrastructure.
- Keep feature-specific error interpretation in the feature layer.
- Display safe user-facing messages.
- Do not expose backend stack traces or internal diagnostics.
- Do not silently swallow errors.
- Avoid catch blocks that only rethrow the same error.
- Preserve trace/correlation metadata when the existing design requires it.

Handle errors at the layer where they can be meaningfully interpreted.

---

## UI States

Backend-driven pages should intentionally handle relevant states:

```text
loading
loaded
empty
error
```

Do not treat empty data as a request failure.

Prefer existing discriminated state patterns over multiple overlapping booleans when appropriate.

---

## Styling and Accessibility

The project primarily uses Tailwind CSS utilities.

Rules:

- Follow existing visual patterns.
- Prefer existing Tailwind utilities.
- Avoid introducing another CSS framework.
- Avoid unnecessary custom CSS.
- Avoid unrelated UI redesign.
- Preserve responsive behavior.
- Preserve accessible contrast.

Accessibility is part of correctness.

When editing UI:

- use semantic HTML
- use buttons for actions
- use links for navigation
- preserve keyboard interaction
- provide accessible labels
- preserve focus behavior
- avoid click-only non-semantic elements
- preserve useful ARIA attributes

If adding component CSS, verify that the stylesheet is actually attached to the component.

---

## Security

Anything bundled into the Angular application must be considered visible to users.

Rules:

- Never embed secrets or API credentials.
- Do not expose internal backend diagnostics.
- Treat backend data as untrusted input.
- Avoid bypassing Angular sanitization.
- Do not render untrusted HTML without a clear reason.
- Do not log sensitive user data.
- Preserve existing authentication/security boundaries.

---

## Performance

Avoid premature optimization, but do not introduce obvious inefficiencies.

Rules:

- Preserve lazy loading.
- Avoid unnecessary subscriptions.
- Avoid accidental repeated HTTP calls.
- Use appropriate `track` expressions in `@for`.
- Avoid heavy template logic.
- Avoid duplicate large state.
- Avoid large dependencies for small utilities.
- Consider bundle impact when adding dependencies.

Do not sacrifice readability for speculative performance improvements.

---

## Formatting

Follow existing formatting conventions:

- UTF-8
- 2-space indentation
- single quotes in TypeScript
- final newline
- Prettier
- Angular HTML formatting

Avoid unrelated formatting churn.

Format/check only relevant files when appropriate:

```bash
npx --no-install prettier --check <files>
npx --no-install prettier --write <files>
```

---

## Testing

Use the existing Angular test infrastructure and conventions.

Rules:

- Add or update tests when behavior changes.
- Prefer focused tests.
- Test meaningful behavior rather than implementation details.
- Cover important success, failure, empty, and affected edge cases.
- Reuse existing TestBed patterns.
- Do not modify unrelated tests merely to make them pass.
- Do not blindly change expected values.

When a test fails:

1. Determine whether the implementation or test is wrong.
2. Understand the intended behavior.
3. Fix the root cause.

During implementation, run the smallest relevant test set first:

```bash
npm test -- --watch=false --include=<spec-file>
```

Run the full suite only when justified by broader/cross-cutting changes or explicitly requested:

```bash
npm test -- --watch=false
```

Do not run the full test suite after every small change.

---

## Build Verification

Run a production build when appropriate for the scope:

```bash
npm run build
```

Do not run full builds unnecessarily for documentation-only or trivial changes.

Investigate build or bundle-budget failures instead of automatically weakening limits.

Never claim an unrun test or build passed.

---

## Git Safety

Before editing:

```bash
git branch --show-current
git status --short
```

Preserve unrelated user changes.

Do not:

- commit
- push
- pull
- create/switch branches
- rebase
- reset
- clean
- stash
- discard changes
- open pull requests

unless explicitly requested.

Never overwrite unrelated uncommitted work.

---

## Scope Control

Keep every task narrowly scoped.

Rules:

- Implement only the requested behavior.
- Prefer the smallest correct change.
- Do not fix unrelated issues automatically.
- Do not refactor unrelated code.
- Do not rename unrelated files, classes, selectors, methods, or models.
- Do not restructure folders without a concrete reason.
- Do not redesign unrelated UI.
- Do not upgrade dependencies unless required.
- Do not reformat unrelated files.
- Do not introduce global configuration changes for local problems.

If an unrelated issue is discovered, report it instead of automatically fixing it.

---

## Repository Exploration

Use progressive discovery.

Do not scan the entire repository by default.

Preferred workflow:

1. Read this guide once.
2. Understand the task.
3. Inspect files explicitly mentioned by the task.
4. Inspect the nearest related implementation.
5. Inspect at most one or two similar examples if needed.
6. Use targeted searches for missing information.
7. Expand scope only when current context is insufficient.

For component work, usually start with:

```text
component.ts
component.html
component.spec.ts if relevant
```

For API work, usually start with:

```text
feature service
relevant model / DTO
relevant page/component
closest similar API integration
relevant tests
```

Inspect CSS only when styling is relevant.

Do not preload large parts of the repository "for context."

---

## Context and Command Efficiency

Minimize unnecessary context usage.

Rules:

- Read only relevant sections of files.
- Prefer targeted `rg` searches.
- Avoid repeatedly reading unchanged files.
- Avoid repository-wide exploration when a nearby example is sufficient.
- Do not load unrelated documentation.
- Do not inspect generated output unless debugging requires it.
- Avoid large command outputs.
- Do not repeat commands when results are already known.
- Use existing code as documentation whenever possible.

Prefer targeted commands:

```bash
git status --short
git branch --show-current
git diff --stat
git diff
rg "<search-term>" src
```

Do not routinely scan:

```text
node_modules/
.angular/
dist/
coverage/
package-lock.json
generated output
```

Inspect dependency metadata only when a specific tooling/dependency question requires it.

---

## Before Coding

Before modifying files:

1. Understand the requested behavior.
2. Inspect Git state.
3. Identify the smallest relevant file set.
4. Find the closest existing implementation.
5. Check existing conventions.
6. Determine the minimal change.
7. Identify the smallest useful verification step.

Ask for clarification only when ambiguity could significantly affect:

- architecture
- API contracts
- routing
- shared state
- security
- backend compatibility
- public behavior

For small implementation details, follow existing conventions rather than asking unnecessary questions.

---

## During Coding

While implementing:

- Keep changes minimal.
- Write clean, readable, maintainable code.
- Apply SOLID where appropriate.
- Preserve Angular conventions.
- Preserve existing architecture.
- Keep components focused.
- Keep API logic out of components.
- Keep state predictable.
- Avoid duplication.
- Avoid unnecessary dependencies.
- Avoid unnecessary abstractions.
- Avoid speculative functionality.
- Preserve accessibility.
- Do not modify generated files.
- Do not perform unrelated cleanup.

Do not trade readability for fewer lines.

Do not over-engineer simple behavior.

---

## After Coding

After implementation:

1. Run relevant focused tests.
2. Run formatting/build checks when appropriate.
3. Inspect the final diff.
4. Confirm no unrelated files changed.
5. Remove debug code or accidental `console` logging.
6. Verify code remains readable and maintainable.
7. Report actual verification results.

Use:

```bash
git diff --stat
git diff
```

Do not commit or push unless explicitly requested.

---

## Review Tasks

When asked only to review:

- Treat the task as read-only.
- Do not modify files.
- Review the current diff first when applicable.
- Inspect surrounding code only when needed.
- Avoid expensive commands unless necessary.

Focus on:

- correctness and regressions
- Clean Code / SOLID
- readability and maintainability
- Angular conventions
- component responsibilities
- RxJS and signal correctness
- API compatibility
- routing
- error handling
- accessibility
- security
- performance regressions
- test coverage
- unnecessary complexity

Prioritize concrete defects and maintainability risks over subjective style preferences.

---

## Windows Notes

When PowerShell script execution prevents npm/npx wrappers, use:

```text
npm.cmd
npx.cmd
```

Do not change the user's PowerShell execution policy solely to run project commands.

Preserve UTF-8 for multilingual files.

Verify source content before assuming terminal rendering artifacts indicate file corruption.

---

## Documentation

Keep `AGENTS.md` focused on stable agent instructions.

Update it only when changes materially affect:

- architecture
- project conventions
- API conventions
- important tooling
- testing workflow
- persistent implementation constraints

Do not turn this file into:

- project documentation
- a route catalog
- a feature status report
- a known-bug backlog
- a chronological work log

Implementation details that can be discovered from source code should generally remain in source code.

---

## Response Style

Keep final responses concise.

For implementation tasks, report:

- what changed
- files changed
- tests/build actually executed
- result
- important risks or unresolved issues

Do not:

- repeat code already written to files
- narrate repository exploration
- list every command
- provide long theoretical explanations unless requested
- claim unrun tests or builds passed

Example:

```text
Implemented lesson API integration.

Changed:
- lesson.service.ts
- lesson-list.ts
- lesson-list.spec.ts

Verification:
- lesson-list.spec.ts: PASS
- npm run build: PASS

No unrelated files changed.
```

---

## Definition of Done

A task is complete when:

- requested behavior is implemented correctly
- code is clean, readable, and maintainable
- SOLID is respected where appropriate
- Angular conventions and architecture are preserved
- state and API boundaries remain clear
- accessibility and security are preserved
- relevant tests pass
- build passes when appropriate
- no unrelated files were modified
- final Git diff was reviewed
- important risks or limitations were reported

Do not commit or push unless explicitly requested.