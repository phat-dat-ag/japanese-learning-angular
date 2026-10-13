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

## Phase 9 — browser E2E and production-readiness verification (2026-10-12)

### Environment and safety

This record supplements, rather than replaces, Phase 8.4 above. The final Phase 9 run exercised
Chrome → frontend NGINX → gateway NGINX → .NET/SQL Server and Quarkus/MySQL. It was not a mock
backend run. Windows, Node 24.20.0, npm 11.19.0, Docker Engine 29.7.2, Angular 22.1,
Playwright 1.64.0, and the installed Chrome channel were used. Only Chromium-family browser
coverage is claimed. The existing `jp_learning_dev` Compose project was reused.

| Service        | Loopback port | Verification                                                                                   |
| -------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| frontend       | 8088          | Current Angular source rebuilt into production NGINX image; SPA fallback and browser workflows |
| gateway        | 8080          | Existing bind-mounted configuration; `nginx -t` and reload after route fix                     |
| user-api       | 8081          | Existing healthy image; real registration, login, `/me`, refresh, logout and role enforcement  |
| vocabulary-api | 8082          | Existing healthy image; real quiz endpoints, ownership, optimistic locking and reporting       |
| mysql          | 3306          | Existing healthy database; isolated lesson/questions/sessions/progress                         |
| sqlserver      | 1433          | Existing healthy database; isolated accounts and refresh tokens                                |

Backend image identities (existing images were not rebuilt):

- user-api: `sha256:3c6bc0b29bddb66422c8efb177d8f030428e2e39e5c45c47ba5b7f40f5cf01e8`
- vocabulary-api: `sha256:c250dd9c6d17af76e72c0fa7ee131b5556aad4e2286dbf1fbe8c394d501b8b92`
- gateway: `sha256:73c75df4075c918f91017fdda46ad81e55e5af77ba3a64ca3d5014bd9244fe7f`
- final tested frontend: `sha256:cb65fa714c87c112ac60863421e790ae8b47017a1c29e1f1ac552127af40ff13`

Checkout baselines: Angular `d9353e1`, .NET `07d86ff`, Quarkus `4b8d7cd`. Reused backend image
identities are recorded separately: their equality to the current source checkout is not asserted.
The pre-existing .NET `Program.cs`, Quarkus `application.properties`, submodule pointers, and
root `import-file/` changes were preserved.

The Docker Linux engine was initially unavailable; it subsequently became available with six
healthy development services. No database service was started/recreated, migrations run, volume
deleted, database reset, or secret overwritten. `.env` and both JWT PEM files were checked for
presence without printing values. Compose requires database passwords and read-only key mounts;
readiness checks include actual database queries and backend readiness endpoints. Production and
observability overlays were inspected, but not deployed or tested. Production removes public
backend/database ports and separates internal networks; the development ports above are loopback.

The browser fixture explicitly requires `QUIZ_E2E_PROJECT=jp_learning_dev`, checks Compose
ownership, rejects a production-named Compose configuration, and checks all six services are healthy.
It registers three UUID-named accounts through .NET, promotes only the newly registered Admin in
SQL Server, and creates one UUID-named lesson in MySQL. Questions are created/imported through the
UI. Cleanup runs in `finally`, targeting exact generated subjects, emails, and the run marker.
It refuses to remove questions referenced by someone else's snapshots. Abrupt process termination
or a cleanup/database error can leave fixtures: inspect the printed `quiz-e2e-<UUID>` marker before
manual cleanup. No wildcard deletion or global Docker cleanup is used. The final run printed cleanup
success for `quiz-e2e-8e308d6e-4c22-4c12-b577-716f70a36b9e`; failed development iterations also cleaned up.
Authentication requests are paced below the unchanged gateway budget. Traces, HAR, video,
screenshots, and storage-state persistence are disabled to avoid saving credentials.

### Reproduced defects and fixes

1. **Gateway omitted both quiz API families.** Before the fix, `/api/v1/kanji-quiz/config` returned
   401 directly on 8082 but 404 on 8080 and 8088. Added bounded routes for player APIs and
   `/api/v1/admin/kanji-quiz/questions`, preserving URI, authorization headers, rate limits,
   request-size limits, and backend authorization. All three entry points subsequently returned
   401 for anonymous requests. Added the quiz family to sanitized route logging and extended the
   existing isolated gateway security script's route/header checks.
2. **Publish stayed disabled after saving a correct-answer change.** Reproduced against a fresh
   production frontend build. The parent evaluated a nonreactive child FormControl dirty flag
   before the child reset it. Exposed that dirty state through Angular `toSignal` so the parent
   updates. A unit regression and the real browser change-correct-answer → publish workflow pass.
3. **Reload lost the in-progress quiz destination.** Tokens remain intentionally memory-only;
   sign-in is still required after reload. The guard now preserves only a numeric local quiz
   session/results path, and User login returns to it. External URLs, arbitrary routes, query
   strings, fragments, traversal and unsafe IDs are rejected; Admin routing stays separate.
   The browser reloads an in-progress session, signs in, and resumes the same four-option question.

The initially deployed frontend was stale: player URLs fell through to the guest landing page.
It was rebuilt from this checkout using the existing Dockerfile. This was an environment issue,
not an application routing fix. Test development also corrected confirmation-dialog handling,
contract field `sessionId`, and a PowerShell-encoded Japanese selector. Rapid repeated test runs
returned genuine gateway 429 responses; test traffic was paced instead of weakening limits.

### Scenario results

All entries marked PASS below were automated; no separate manual visual sign-off was performed.

| Scenario                          | Result and scope                                                                                                                                                                                                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser navigation/guards         | PASS: anonymous setup, session, history and Admin deep links redirect to sign-in; document requests use SPA fallback                                                                                                                                                                     |
| Admin creation/validation/editing | PASS: required-field validation, CUSTOM Unicode reading, four options, content save, option text edit, correct-answer change and reset                                                                                                                                                   |
| Lifecycle and conflicts           | PASS: publish, competing unpublish, stale-version 409, visible reload-latest recovery, republish and archive/read-only UI                                                                                                                                                                |
| JSON preview/import               | PASS: browser file selection, client preview, real multipart upload, one imported item and one invalid lesson reference; indexed partial result summary                                                                                                                                  |
| Player setup/loading/recovery     | PASS: isolated lesson filtering, invalid count, held loading state, visible simulated 503 and retry to actual backend                                                                                                                                                                    |
| Gameplay and restoration          | PASS: real session creation, emoji before the kana target, four options, disabled empty submission, hard reload/sign-in resumes the same session                                                                                                                                         |
| Answers/completion                | PASS: correct and incorrect feedback in two sessions; duplicate answer and repeated finish return 409; cancel/confirm finish and results navigation                                                                                                                                      |
| History/progress                  | PASS: completed results/history survive reauthentication; actual aggregate counts are 2 completed, 2 answered, 1 correct, 1 incorrect; ASSIGNED lesson breakdown                                                                                                                         |
| JWT/roles/ownership               | PASS: real .NET-issued tokens accepted by Quarkus; invalid/anonymous 401, User denied Admin APIs with 403; foreign User and Admin denied another player's session with 404; foreign history detail 404                                                                                   |
| Refresh/logout                    | PASS: one browser request deliberately sends an invalid bearer token to real Quarkus; Angular responds to its 401 by calling real .NET refresh and retrying successfully; raw API rotation, old-refresh replay rejection and logout revocation                                           |
| Gateway boundaries                | PASS: misleading path prefixes and infrastructure paths 404; correlation response ID, no-store/nosniff; untrusted Origin receives no CORS allow-origin; >10 MiB import bodies rejected with 413 at both frontend and gateway                                                             |
| Responsive behavior               | PASS: 390×844 login and gameplay have no horizontal document overflow; desktop workflow exercised. Not a full visual/accessibility audit                                                                                                                                                 |
| Browser diagnostics               | PASS: no uncaught page errors on Admin/Player flows. Expected 503/401 fault injections and deliberate API negatives are explicit. Comprehensive console-warning/network-event auditing is not implemented                                                                                |
| UNKNOWN vs UNASSIGNED             | NOT RETESTED in Phase 9 browser/full-auth stack. Phase 8.4 separately records real Quarkus/MySQL coverage of both; those results must not be relabeled as Phase 9 browser passes                                                                                                         |
| Remaining scenarios               | NOT TESTED here: natural JWT expiry against .NET clock, EXAMPLE creation/play in a browser, rapid duplicate UI clicks for every mutation, multi-question browser sessions, browser pagination, comprehensive Admin mobile layout, Admin editor URL recovery after reload, Firefox/WebKit |
| Forwarding/security stress        | Source reviewed, NOT live-reverified: spoofed forwarding header removal, timeout/framing/rate-limit stress, production TLS/proxy topology. The extended Python gateway harness was not run because no usable host Python interpreter was available                                       |

The held response and injected 503 are deterministic browser fault simulations. The subsequent
401, refresh, retry, and all normal workflows travel through the real services. Simulated invalid
bearer recovery is not evidence that natural access-token expiration was exercised.

### Reproduction and verification commands

From the root, only the frontend was rebuilt/recreated; database dependencies were excluded:

```powershell
docker compose -p jp_learning_dev config --quiet
docker exec jp_learning_dev-gateway-1 nginx -t
docker exec jp_learning_dev-gateway-1 nginx -s reload
docker compose -p jp_learning_dev build frontend
docker compose -p jp_learning_dev up -d --no-deps --wait frontend
```

From `angular` (requires the named existing healthy development stack and database CLI access
inside its containers; this suite deliberately does not provision an arbitrary environment):

```powershell
npm.cmd ci
npx.cmd playwright install chromium
$env:QUIZ_E2E_PROJECT='jp_learning_dev'
# Optional: final verification used installed Chrome; omit to use Playwright Chromium.
$env:QUIZ_E2E_BROWSER_CHANNEL='chrome'
npm.cmd run test:quiz:e2e
npm.cmd test -- --watch=false --include=src/app/features/admin/kanji-quiz/**/*.spec.ts --include=src/app/features/kanji-quiz/**/*.spec.ts --include=src/app/core/auth/*.spec.ts --include=src/app/core/api/*.spec.ts --include=src/app/features/auth/*.spec.ts
npx.cmd tsc --noEmit -p tsconfig.app.json
npx.cmd tsc --noEmit -p tsconfig.spec.json
npm.cmd run build
git diff --check
```

Final browser result: **2 tests passed in 54.5 seconds**, containing the compound scenarios above.
Affected unit suite: **526 tests passed in 26 files**, with 4 opt-in Phase 8.4 live tests skipped.
Post-change app/test TypeScript checks passed. Local and Docker production builds passed; final
local initial bundle was 45.59 kB, within budgets. Changed/new JS and relevant TypeScript formatting
checks passed. Root, Angular, .NET and Quarkus `git diff --check` passed. Gateway config test and all
six development service health checks passed. No .NET/Quarkus source files were changed or backend
unit suites rerun. No commits or pushes were made.

### Remaining production-readiness risks and merge verdict

The exercised full-stack workflow passes, but **Phase 9 production-readiness sign-off is incomplete**.
Do not call the entire requested matrix verified. Natural expiration, historical classification
browser coverage, forwarding/security stress, and the other explicitly untested rows remain.
The gateway currently sees the frontend proxy as its client; per-IP auth budgets can therefore be
shared by frontend users. Repeated browser verification hit that budget. This needs deployment-level
review before production scale, without trusting arbitrary client-supplied forwarding headers.

`npm audit --omit=dev` reported one high-severity finding in the existing `@angular/router`
version range (`>=22.0.0 <22.2.0`), advisory GHSA-ff3f-86qr-9cv3, titled “Angular Server-Side Rendering
(SSR): Denial of Service via Numeric URL Matrix Parameters”. This deployment serves a static SPA
from NGINX; advisory applicability still needs explicit dependency/security triage. No unrelated
Angular upgrade or automatic audit fix was performed. The initial full dependency install also
reported 14 findings including development dependencies; those were not comprehensively triaged.

Recommendation: the focused fixes are reviewable, but **do not mark Kanji Quiz ready to merge into
develop as a completed Phase 9 milestone** until the remaining required scenarios and security
triage are resolved or explicitly accepted. No claim of production deployment certification is made.

### Changed-file manifest

Root repository:

- `gateway/nginx.conf`
- `scripts/verify-gateway-security.py` (extended; Python harness not executed)

Angular submodule:

- `.gitignore`
- `package.json`, `package-lock.json`
- `playwright.config.mjs` (new)
- `e2e/fixtures.mjs`, `e2e/kanji-quiz.spec.mjs` (new)
- `src/app/core/auth/auth-destination.ts`
- `src/app/core/auth/auth-destination.spec.ts` (new)
- `src/app/core/auth/role.guard.ts`
- `src/app/features/auth/login.ts`, `src/app/features/auth/login.spec.ts`
- `src/app/features/admin/kanji-quiz/components/question-options.ts`
- `src/app/features/admin/kanji-quiz/pages/question-editor.spec.ts`
- `src/app/features/kanji-quiz/kanji-quiz.routes.spec.ts`
- `docs/kanji-quiz-integration.md`

.NET and Quarkus: no files changed by Phase 9. Final read-only cleanup checks found zero
questions, zero lessons, and zero accounts for the final run marker.

## Phase 9 final hardening follow-up (2026-10-13)

This section supersedes the unresolved-gap assessment above only for the checks listed here.
The earlier Phase 8.4 and Phase 9 results remain historical evidence, not newly rerun claims.
All passes below are automated; no manual visual sign-off was performed.

### Environment and safety

Reused healthy `jp_learning_dev` on Windows/PowerShell, installed Chrome via Playwright 1.64.0,
frontend `http://127.0.0.1:8088`, gateway 8080, .NET 8081, Quarkus 8082, MySQL 3306 and SQL Server 1433.
Browser traffic used the existing frontend NGINX image and both real backends/databases. No service
was restarted or redeployed during natural expiry. The final Docker frontend build was validated
but not deployed; no application-source changes were needed in this follow-up. Existing image/source
provenance limitations above still apply. All six service health checks passed at completion.

No Quarkus/.NET source, contract, schema, token lifetime, security setting, secret or existing data
was changed. Test cleanup targeted only newly registered accounts and their exact fixture resources.
Read-only cleanup checks found **zero questions, lessons and accounts** for these four run markers:

- `quiz-e2e-2719f7d6-2f5a-4186-a532-825fc291f11b` (classifications)
- `quiz-e2e-ffbb0c48-cbcf-49bb-9d4c-8126ebfc11ff` (natural expiry)
- `quiz-e2e-461f4ad4-e15d-4ac7-b970-48d02149e7b7` (failed timing-race iteration)
- `quiz-e2e-5a2bc451-4a16-489c-a67b-e2f7ffdacb59` (final main browser pass)

Session/snapshot cleanup ran successfully through the fixture's existing subject-scoped cascade.
All temporary `jp-gateway-security-*` containers and networks were removed by the harness. No volumes
were removed. A portable official Python 3.13.16 embeddable runtime was downloaded into ignored
`angular/tmp/phase9-python`; Windows Authenticode validation of python.exe returned Valid. It is a
local execution aid, not a repository/runtime dependency. No commits, pushes or merges were made.

### Final coverage and results

| Scenario | Result and evidence |
| --- | --- |
| Natural JWT expiration | PASS, new opt-in browser test, **1 passed in 15.6 minutes**. Asserted the real login response lifetime is 900 seconds, decoded exp in memory and waited until exp + 3 seconds (`2026-10-12T23:58:18Z`). No forged expiry, clock mocking or lifetime change. Both .NET `/api/auth/me` and Quarkus session read rejected the original token with 401. |
| Browser refresh-token recovery | PASS: submitting an answer after natural expiry produced actual answer statuses `[401, 200]`, with real .NET refresh 200 between them. Replacement JWT differed and authenticated against .NET; replay of the original refresh token returned 401. |
| Session restoration after recovery | PASS: same session URL after refresh; browser reload required sign-in because credentials remain memory-only. Sign-in restored that session, including the answered state, then Finish Game reached results. No uncaught page errors. |
| UNKNOWN / UNASSIGNED | PASS, new browser test, **1 passed in 27.8 seconds**. Isolated historical snapshots for the newly registered player were read through Angular -> frontend NGINX -> gateway -> Quarkus -> MySQL after real .NET login. Both level and lesson UI tables matched actual backend buckets: UNKNOWN = 1 session / 1 answer / 1 correct / 0 incorrect / 100%; UNASSIGNED = 1 / 2 / 1 / 1 / 50%. Labels remained distinct. |
| Classification fixture scope | UNKNOWN uses `classifications_captured=false`; UNASSIGNED uses true with no assignment snapshot rows. These are transactionally seeded historical reporting fixtures using existing tables, not current-API creation of legacy history or a migration test. No shared question-bank references or schema changes. |
| Existing main browser regression | Final PASS: **2 tests in 54.3 seconds**, covering the previously documented Admin/Player workflow, import, recovery, roles/ownership, responsive checks and gateway boundaries. A preceding run failed because the test refreshed before Angular navigation completed; see fixes below. |
| Actual frontend + gateway forwarding configs | PASS against isolated synthetic upstreams: Authorization preserved, spoofed Forwarded/X-Forwarded-Host/Port/For and related headers sanitized, edge forwarding regenerated, valid correlation preserved, invalid/missing IDs regenerated, single response headers, oversized upload rejected with 413. Real configs and Compose gateway hardening flags used; no production backend echo/debug endpoint added. |
| Bounded gateway controls | PASS in isolated harness: quiz route boundaries, unsupported methods 405, duplicate Host and ambiguous framing 400, oversized headers 400, 10 MiB accepted by synthetic upstream and declared >10 MiB rejected, one incomplete-header timeout, one synthetic upstream outage, sanitized logs without sentinels. No stress/load test or outage of a development service. |
| Live gateway HTTP checks | PASS: direct/backend versus gateway authentication rejection, route parity, OPTIONS, security headers; **44 correlation/validation HTTP cases passed**. Browser tests also covered untrusted-origin CORS and multipart quiz import. |
| Strict live request-log correlation | **FAIL / unresolved environment observability limitation**: final `verify-gateway-security.py --live` exits 1 because `verify-correlation.py` cannot find Quarkus request-completion logs. Gateway and .NET log assertions pass. Quarkus `CorrelationIdFilter` logs completion at DEBUG while `application.properties` defaults application logging to INFO. Correct response IDs do not prove request-log coverage. Logging/backend behavior was not changed, and the strict assertion was not weakened. |
| Dependency security triage | COMPLETE for Angular audit applicability; see [security review](kanji-quiz-security-review.md). 14 affected package nodes remain (3 critical, 6 high, 5 moderate); production-only audit has one high SSR-specific router advisory. Static NGINX SPA is outside that advisory's stated scope; other flagged packages are development tooling. No reachable production npm exploit identified, no broad upgrade or audit suppression applied. Residual tooling risks remain. |
| Focused unit regression | PASS: **526 tests in 26 files**, 4 opt-in Phase 8.4 tests skipped. |
| TypeScript / builds | PASS: app and spec `tsc --noEmit`; local production initial bundle 45.59 kB; Docker production build 45.56 kB, within budgets. |
| Configuration / hygiene | PASS: frontend and gateway `nginx -t`; all six health checks; root, Angular, .NET and Quarkus `git diff --check`. |

### Confirmed fixes in this follow-up

No new application integration defect was confirmed. Prior gateway routing, reactive correct-option
dirty state and safe post-login session destination fixes are retained unchanged.

- Browser harness: session-creation HTTP response can arrive before Angular navigation. Wait for
  the exact returned session URL and four rendered options before exercising refresh. The failing
  test had refreshed the setup page, whose guard correctly does not preserve a session destination.
- Isolated gateway harness: checking `/health` did not establish that the synthetic upstream was
  ready. Start its NGINX directly, validate its config and wait for a proxied probe before assertions.
- Correlation harness portability: use IPv4 loopback to match Compose bindings, explicitly decode
  Docker logs as UTF-8 on Windows, and inspect a bounded 1,000-line tail. Relative `--since` log
  collection returned no records in this environment; the bounded tail recovered .NET evidence.
  Quarkus's missing DEBUG records still fail the original strict assertion.
- Intermediate rapid repeated live import checks received 429 from the unchanged 2/minute import
  budget. Final paced/separated execution passed HTTP checks. No limit was relaxed.

### Reproduction commands

From the root PowerShell session, with the existing healthy development stack:

```powershell
$env:QUIZ_E2E_PROJECT='jp_learning_dev'
$env:QUIZ_E2E_BROWSER_CHANNEL='chrome'
npm.cmd --prefix angular run test:quiz:e2e -- kanji-quiz-classification.spec.mjs
$env:QUIZ_E2E_EXPIRY='1'
npm.cmd --prefix angular run test:quiz:e2e -- kanji-quiz-expiry.spec.mjs
Remove-Item Env:QUIZ_E2E_EXPIRY
npm.cmd --prefix angular run test:quiz:e2e -- kanji-quiz.spec.mjs
$env:COMPOSE_PROJECT_NAME='jp_learning_dev'
# Or use any available Python 3 interpreter. --live currently exits 1 at Quarkus log assertion.
angular/tmp/phase9-python/python.exe -u scripts/verify-gateway-security.py --live
docker compose exec -T gateway nginx -t
docker compose exec -T frontend nginx -t
docker compose build frontend
```

The regular browser suite skips natural expiry unless `QUIZ_E2E_EXPIRY=1`; that skip must not replace
the separate 15-minute result above. Run verification commands sequentially to respect shared auth
and import rate budgets. Focused unit, TypeScript and local build commands are unchanged from the
previous reproduction section. Formatting was checked only for added/changed browser tests.

### Changed files and merge recommendation

Root follow-up changes: `scripts/verify-gateway-security.py` extends checks to both actual proxy
configs and fixes readiness; `scripts/verify-correlation.py` fixes host/encoding/log-window
portability and reports HTTP success separately. Earlier `gateway/nginx.conf` fix is retained.

Angular follow-up changes: `e2e/fixtures.mjs` adds isolated classification history;
`e2e/kanji-quiz-classification.spec.mjs` and `e2e/kanji-quiz-expiry.spec.mjs` are new;
`e2e/kanji-quiz.spec.mjs` waits for navigation before refresh;
`docs/kanji-quiz-security-review.md` is new; this report is extended. Other Phase 9 files in the
previous manifest are retained. No .NET or Quarkus changes were made by this work; their preexisting
working-tree changes and `import-file/` were preserved.

**Recommendation: do not grant unconditional Phase 9 merge sign-off yet.** The exercised full-stack
functional flows and the requested natural-expiry/classification gaps pass, and the changes are
reviewable for develop. However, the strict live gateway verification still exits nonzero on
Quarkus log correlation. Resolve that observability expectation in a separately authorized change,
or explicitly accept and document the INFO-level limitation before calling Phase 9 fully signed off.
Do not represent this as production deployment certification.

Remaining untested scope: production TLS/trusted-proxy topology and scale; Firefox/WebKit; EXAMPLE
creation/play in the browser (Phase 8.4 API evidence only); multi-question browser sessions;
pagination; every rapid duplicate UI mutation; complete Admin mobile layout/editor reload recovery;
comprehensive console/network audit; manual accessibility/visual review. Shared frontend-proxy IP
rate budgets still need deployment review. Container OS, Maven/NuGet and complete supply-chain scans
were not performed. The audit triage does not erase development-tooling advisories. No disruptive
rate-limit, load or stress testing was performed.

## Final merge assessment: logging policy and risk acceptance (2026-10-13)

**CONDITIONAL GO for merging Kanji Quiz into develop.** This assessment supersedes the prior
withhold-sign-off recommendation. No confirmed functional integration blocker remains in the
exercised scope. Merge is conditional on the reviewer explicitly accepting the scoped risks below;
this document recommends acceptance but does not record acceptance on the reviewer's behalf.
It does not authorize or certify a production deployment.

### Quarkus logging finding: intentional policy, not a runtime correlation defect

There is affirmative evidence of intent, beyond the absence of logs:

- Quarkus commit `13cceb4995e5021709585f829cefc5ac6acd1e8f` (`feat: add production file logging`,
  2026-10-05) deliberately changed `CorrelationIdFilter` from `LOG.infof` to `LOG.debugf` for
  request-completion events. The preceding correlation implementation was INFO.
- `quarkus/README.md`, Application logging, documents INFO lifecycle/write outcomes, DEBUG read
  diagnostics, no additional INFO logs for health/authentication flows, and safe central ERROR
  handling. It explicitly describes asynchronous logs as diagnostics, not a durable audit trail;
  overflow and abrupt termination can lose events.
- `application.properties` defaults root/application logging to INFO. Read-only inspection found
  no APP_LOG_LEVEL or inspected root/application Quarkus log-level environment override on the
  healthy running vocabulary-api container. No runtime logging setting was changed.
- The filter assigns the validated ID to request context/MDC and adds the response header
  independently of the DEBUG logging call. The earlier 44 live HTTP cases passed. Gateway and
  .NET completion-log assertions also passed.

The root README's older Step 8.2 verification description and `scripts/verify-correlation.py`
still assume completion logs from both backends regardless of level. The strict script's nonzero
exit is real, but represents an outdated test/policy expectation at INFO, not evidence that HTTP
correlation is broken. Keep the historical failure visible; do not relabel the whole harness green.

| Evidence | Final status |
| --- | --- |
| HTTP correlation propagation, sanitization and response IDs | Automated PASS from final hardening; not rerun in this documentation-only assessment. |
| Gateway and .NET request-log correlation | Automated PASS from the prior strict run. |
| Quarkus per-request completion records at INFO | Intentionally omitted; recommended accepted diagnostic-coverage limitation for this release. |
| Quarkus DEBUG completion-log emission and correlation | NOT TESTED at DEBUG in Phase 9. Source/history inspection establishes design, not a runtime pass. |
| Whole strict `--live` harness | Still exits 1 on its unconditional Quarkus log assertion; scoped waiver required for merge. |

Accept this limitation provided the release does not require a durable per-request backend audit
trail or an INFO completion event from every service. HTTP response IDs and gateway evidence remain
available, but they do not substitute for every backend diagnostic event. No Quarkus code fix or
logging-level increase is warranted by this finding. A future harness improvement should explicitly
separate mandatory HTTP checks from opt-in DEBUG completion-log checks, reporting NOT TESTED rather
than silently passing omitted coverage; update the older root logging documentation with it. Neither
change is implemented here. If a future requirement demands durable auditing, treat that as a separate
observability design, not a global DEBUG switch.

### Risk classification for this release

Here, **accepted risk** means recommended for explicit reviewer acceptance, not already approved.
A production-deployment blocker below is not a blocker to merging into develop.

| Item | Classification | Justification / condition |
| --- | --- | --- |
| INFO omission / strict harness mismatch | Accepted risk, pending reviewer acknowledgement | Deliberate production policy with successful HTTP correlation. Scope the waiver to Quarkus completion-log assertion only; do not waive authentication, headers, gateway or other test failures. |
| High router advisory | Accepted risk for the static SPA deployment | Existing audit's SSR-specific advisory does not apply to the inspected NGINX/client-only deployment. Enabling SSR requires reassessment and remediation before release. |
| Remaining npm findings | Accepted risk with tooling follow-up | Existing snapshot: 14 affected nodes total (3 critical, 6 high, 5 moderate), including inherited parent findings; 13 nodes are development-only. Piscina build-worker, CLI/MCP/Express, test-server and parser/client risks remain real for hostile tooling inputs. Keep privileged CI isolated from untrusted changes and do not expose development/test/MCP servers. No zero-vulnerability claim or forced dependency overrides. See the dependency review for package-level applicability. |
| Container OS / Maven / NuGet / full supply-chain scans | Future improvement; required reassessment if release policy mandates them | Not performed here; npm triage cannot certify these ecosystems. No new evidence of an exploitable deployed dependency was found by this scoped review. |
| Shared frontend-proxy IP rate budgets | Accepted risk for develop; production-deployment blocker until topology/capacity acceptance | Gateway keys on the TCP peer, so frontend users share budgets, including 10/minute login/register and 60/minute refresh. This can cause availability/429 contention despite correct authorization. Require deployment-owner acceptance of intended capacity or a separately reviewed trusted-proxy design before external rollout. Never trust arbitrary forwarded addresses or relax limits merely to pass tests. |
| Production TLS / trusted-proxy topology | Production-deployment blocker; not a develop merge blocker | Only loopback development topology was exercised. Validate TLS termination, exposed ports and trusted-hop boundaries in the actual deployment before public release. |
| Import-rate scope | Future improvement in abuse-policy review | The special 2/minute rule matches vocabulary import, not the quiz Admin import route; quiz import retains general rate/connection/body limits and Admin authorization. Do not describe the special vocabulary budget as quiz coverage. No change or stress test is justified without a deployment requirement. |
| Firefox/WebKit, complete Admin mobile layout and manual visual/accessibility review | Future improvement | Installed Chrome and targeted 390x844 overflow checks passed, not cross-browser or accessibility certification. Make these release gates if the current release promises those browsers or a specific accessibility standard. |
| EXAMPLE browser play, multi-question sessions, pagination, every rapid duplicate mutation, Admin editor reload | Future improvement | These exact browser paths remain untested; existing API/unit coverage and the exercised CUSTOM/one-question browser flows provide partial evidence, not equivalent coverage. Expand regression coverage without claiming these scenarios passed. |
| Comprehensive console/network-event audit | Future improvement | Uncaught page-error checks passed; intentional negative/fault scenarios were identified. No exhaustive warning/network audit was performed. |

### Acceptance conditions and targeted verification

For develop merge, the reviewer should record: (1) acceptance of intentional INFO logging and the
specific strict-harness waiver, (2) acceptance of the documented static-SPA/tooling applicability
and browser coverage limits, and (3) retention of the production topology/capacity gates above.
If blanket green strict-harness status, durable request auditing, or unsupported browser/accessibility
certification is mandatory for this merge, the condition is not met and the decision becomes NO-GO
until that requirement is addressed. No broad failure waiver is recommended.

This assessment used only source/documentation reads, the targeted Git history diff, sanitized
container logging-override/health inspection, and final diff checks. No HTTP probes, browser suites,
15-minute expiry test, audits or builds were repeated; prior results are reused unchanged. Only this
report was edited in this assessment. Quarkus, .NET, harnesses, logging settings, databases, volumes,
secrets and all unrelated changes were preserved. No commit, push or merge was performed.
