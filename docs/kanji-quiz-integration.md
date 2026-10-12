# Kanji Quiz integration verification

Run from the Angular repository:

```powershell
npm.cmd run test:quiz:live
```

Prerequisites: installed Angular dependencies, Node compatible with Angular 22, Docker Desktop
with Linux containers, and the sibling `../quarkus` checkout. Docker must be able to build the
backend Dockerfile and obtain its pinned base images and MySQL image. The test issuer uses
Docker Desktop's `host.docker.internal` hostname. Native Linux Docker is not verified.

## Isolation and transport

The runner builds the current Quarkus source without writing to that checkout. Each invocation
creates uniquely named, ownership-labelled containers and a network, a MySQL database on tmpfs,
and ephemeral RSA signing keys. No existing backend URL, credentials, database, or volume is
accepted. The API is published on a dynamically allocated loopback port. Current SQL migrations
are applied in numeric order to the fresh database; this does not test Flyway upgrade/history
behavior. Fixed fixture IDs are safe because the database is disposable and belongs to the run.

The runner seeds only prerequisite lessons/examples and one legacy completed snapshot whose
classification was never captured. All new quiz questions, imports, sessions, answers, and
completions go through the actual Quarkus HTTP APIs. It checks the live OpenAPI for the reporting
and import paths. Angular's real services, response validators, auth interceptor, pages, lazy
routes, and guards are used; there is no `HttpTestingController` or mocked feature service.

The suite uses existing Vitest/jsdom and RouterTestingHarness infrastructure. It selects Angular's
XHR backend because Node 24's fetch serializes jsdom FormData as `text/plain` / `[object FormData]`.
XHR sends actual multipart requests from jsdom. Production transport configuration is unchanged.
The raw rejected-JWT checks use read-only fetch requests, avoiding the separate .NET refresh API.

`KANJI_QUIZ_ISOLATED_TEST` is internal runner configuration containing short-lived test credentials;
do not set it manually or persist it. Ordinary unit-test runs skip the live suite. The runner
cleans up its own labelled containers/network and image tag after success or failure. An abrupt
process/host termination can prevent cleanup; inspect the run-specific `angular-quiz-<UUID>`
resources and their ownership labels before removing leftovers. No global Docker cleanup runs.

## Live scenarios

| Scenario                          | Assertions                                                                                                                                                                                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin CUSTOM creation and editing | Create from routed editor; repeated save is guarded; four returned options; edit each option; change the correct option; publish; stale version returns 409; a competing edit produces a visible conflict and reload; publish/unpublish/archive transitions.      |
| Admin EXAMPLE creation            | Existing example reference, correct source shape, four options, publication eligibility and archival. A separate EXAMPLE is also played to completion.                                                                                                            |
| JSON preview/import               | Real File/FileReader preview, multipart upload, rapid duplicate-submit calls, one imported draft and one backend-rejected missing lesson, indexed partial-success result rendering.                                                                               |
| Configuration and setup           | Real availability counts, supported level and lesson selection, session creation, duplicate start protection, route session ID preservation.                                                                                                                      |
| Gameplay/restoration              | Four options, no correctness fields before submission, emoji before the target verifies Unicode code-point highlighting, incomplete results state, destroy/recreate gameplay from the session URL, immutable explanation after a published bank edit.             |
| Answering and completion          | Correct and incorrect feedback, rapid repeated submissions/next actions, distinct next questions, duplicate answers and premature/repeated finish return 409, cancel/confirm finish, completion navigates to results.                                             |
| Results/history                   | Review selected/correct answers for every question, completed counts from backend, direct results navigation, history page/size query parameters and correct records on successive pages.                                                                         |
| Progress                          | Real overall counts and level/lesson breakdowns; ASSIGNED, UNASSIGNED, and historical UNKNOWN coexist; UNKNOWN and UNASSIGNED each retain their own backend counts.                                                                                               |
| Authorization/empty states        | Anonymous/expired/wrong issuer/wrong audience: 401; lowercase `user` and User accessing Admin APIs: 403; foreign user and Admin accessing another user's session/history: 404; unavailable result page, empty history/progress, sign-out leaves protected routes. |

## Verification record — 2026-10-12

Environment: Windows, Node 24.15.0, Docker Engine 29.5.2, Angular 22, Vitest 4.1.10,
MySQL 8.4, Quarkus built from the local checkout at `4b8d7cd`. The existing local Quarkus
`application.properties` modification was preserved; no Quarkus or OpenAPI files were edited.

- Live integration: **4 scenario tests passed**, against the newly built Quarkus service and
  isolated MySQL. Cleanup completed; existing development containers were left running.
- Focused Admin/Player/API/auth regression suite: **463 tests passed in 22 files**; the 4 opt-in
  live tests were skipped in this separate ordinary run.
- App TypeScript check: passed (`tsc --noEmit -p tsconfig.app.json`).
- Test TypeScript check: passed (`tsc --noEmit -p tsconfig.spec.json`).
- Production build: passed (`npm run build`); initial bundle 45.33 kB, within configured budgets.
- Runner syntax, changed-file formatting, and `git diff --check`: passed.

Focused regression command:

```powershell
npm.cmd test -- --watch=false --include=src/app/features/admin/kanji-quiz/**/*.spec.ts --include=src/app/features/kanji-quiz/**/*.spec.ts --include=src/app/core/auth/*.spec.ts --include=src/app/core/api/*.spec.ts
```

The existing focused tests additionally cover controlled network failures, retry states, stale
responses, partial progress failures, invalid inputs, and route protection. Those failure cases
use deterministic HTTP mocks; they are not represented as live network-fault tests.

## Findings and limits

No confirmed Angular/Quarkus integration defect was found in the exercised workflows. The first
live attempt exposed the jsdom/Node multipart transport incompatibility described above; that was
fixed in the test harness, without changing production code. No backend defect remains from these
scenarios.

This is live HTTP + Angular DOM/router integration, not browser E2E. It does not verify visual
layout, real-browser interaction, deployed SPA fallback on hard refresh, the nginx gateway, or
.NET login/refresh/logout. JWT signature/claims/role enforcement is tested by real Quarkus using
an isolated test issuer. Direct session restoration is tested after recreating the Angular page
with an authenticated test session; the application's existing memory-only authentication still
requires sign-in after a full browser reload. Full deployment/browser verification remains a
separate check; no success is claimed for those unrun scenarios.
