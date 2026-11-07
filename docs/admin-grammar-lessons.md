# Admin Grammar Lesson Management

## Routes and workflows

All routes inherit the `/admin` Admin guards and use the existing Admin shell.

| Route                              | Purpose                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `/admin/lessons?level=N5`          | Ordered lesson catalogue, level selection, edit/content links and confirmed deletion |
| `/admin/lessons/new`               | Create metadata using the backend level ID                                           |
| `/admin/lessons/:lessonId/edit`    | Replace metadata using persisted level ID and display order                          |
| `/admin/lessons/:lessonId/content` | Edit, preview, export, save or delete grammar content                                |
| `/admin/lessons/import`            | Complete grammar JSON import                                                         |
| `/admin/lessons/import/metadata`   | Existing metadata-only batch import                                                  |

Choose N5–N1, create lesson metadata, then open Content. Metadata and content are saved
separately. Lesson list ordering comes from the server; IDs and display orders are never
inferred. Metadata writes require positive integer level ID, lesson number and display order,
a nonblank title up to 200 UTF-16 code units, and an optional description up to 1,000.
Lesson number and display order are unique within a level. Metadata replacement has no
optimistic concurrency contract. Referenced lesson deletion returns `409 LESSON_CONFLICT`;
deleting an unreferenced lesson also removes optional grammar content.

## Structured content

Schema version 1 supports heading (levels 1–6), paragraph, ordered/unordered list, table,
example, callout (note/tip/warning/information), quote and divider. Text runs support bold,
italic and underline. Examples have Japanese text, reading, Vietnamese and English translations.
Add/select/edit/remove/reorder blocks, edit list/table structure, and inspect the live preview.
Content is plain text rendered with Angular bindings, never HTML or `contenteditable`.

An empty document is valid. Limits include 200 unique block IDs, 1–100 runs per inline array,
1–100 list items, rectangular tables with 1–100 rows and 1–20 columns, and 10,000 UTF-16 code
units per text field. Example fields must be nonblank. Angle brackets and disallowed control
characters are rejected. Compact content is limited to 1 MiB. Direct PUT also bounds the
entire request to 1 MiB and 100,000 JSON tokens; its known schema fits the depth limit of 12.

Creation uses `expectedVersion: 0` without `If-Match`. Updates/deletion send the positive
version and exact quoted ETag from the latest GET/PUT. Successful saves retain the returned
revision/ETag and clear dirty state. Missing ETags, conflicts, or uncertain mutation outcomes
preserve the draft and require explicit reload before another write. Export the draft first;
reload/discard requires confirmation. Navigation and browser unload warn about unsaved edits.
Content deletion preserves metadata/assignments and requires confirmation plus current
preconditions. A missing document (`LESSON_CONTENT_NOT_FOUND`) differs from a missing lesson
(`RESOURCE_NOT_FOUND`); an empty saved document still has a version/ETag.

## JSON imports

Complete import posts the **original selected file** as multipart field `file` to
`v1/lessons/content/import?mode=SKIP_EXISTING` or `UPDATE_EXISTING`, relative to `/api`.
No trimming, ETag injection, JSON reserialization or automatic mutation retry is performed.
An indeterminate loading message covers upload/processing; ApiClient exposes responses,
not upload progress percentages.

```json
[
  {
    "level": "N5",
    "lessonNumber": 90001,
    "title": "Trợ từ は",
    "description": "Disposable integration lesson",
    "displayOrder": 90001,
    "schemaVersion": 1,
    "expectedVersion": 0,
    "content": { "blocks": [] }
  }
]
```

Use unused numbers/orders in a disposable test environment; the example does not reserve them.
The authoritative full example is `../quarkus/docs/grammar-lessons-import-example.json`.

- `SKIP_EXISTING`: create missing lessons; existing lessons are skipped, even without content.
- `UPDATE_EXISTING`: atomically replace each existing lesson's metadata/content. Existing
  content needs its current positive `expectedVersion` and `etag` copied verbatim from GET
  content, including quotes, with the quotes escaped inside the JSON string. Absent content or a new
  lesson needs version 0 and no `etag`. The frontend never fetches/replaces file preconditions.

Browser checks require UTF-8 JSON, 1–100 items, at most 5 MiB, supported metadata/content fields,
and no duplicate lesson numbers/display orders within the same trimmed level code. Local
`JSON.parse` does not detect duplicate object keys or preserve numeric token spelling; the
unaltered upload still receives strict backend parsing. Local success is not server preflight.
Imports reuse document validation without imposing direct-PUT request/token limits.

Quarkus performs full-file preflight before writes: strict parsing, schema, duplicate resolved
keys/orders, existing levels, and occupied orders. Occupied-order swaps are unsupported.
After preflight each item commits independently, with its metadata/content atomic together.
HTTP 200 reports `total`, `created`, `updated`, `skipped`, `failed`, and ordered `results`.
UI item numbers are one-based; stored `index` values remain zero-based. A failed item includes
safe error code/message/details; other successful items remain committed. A whole-file error
returns the ordinary failure envelope, not an item report.

Timeouts, network/5xx errors, or malformed reports have **unknown outcomes**: some items may
already be committed. The UI prevents another submission until a file is selected again.
Inspect server data first. Intentional SKIP retries can skip prior successes; UPDATE retries
need fresh revisions/ETags. There is no idempotency key. Keep the last completed report for
comparison; it is labeled with its filename and mode.

Metadata-only import remains independent at `v1/lessons/batch`, multipart field `file`.
Its JSON items contain `levelId`, `lessonNumber`, `title`, `displayOrder`, optional description;
they contain no content envelope. Its existing 1 MiB/100-item limits and
`total/succeeded/failed/results` report are unchanged.

## Backend and deployment compatibility

Use Quarkus grammar lesson management with V12 applied, schema version 1, and the updated
catalogue DTOs: levels expose `id/code/name`; lesson reads/writes expose
`id/levelId/lessonNumber/title/description/displayOrder`. Check the DTOs and OpenAPI as well
as `docs/grammar-lessons.md` in the sibling backend; older prose may describe four-field reads.
Successful writes, including deletes, return HTTP 200 with the existing success envelope.

All frontend services use `/api` through API_CONFIG and the existing Bearer interceptor.
The default timeout is 15 seconds. Development proxy forwards to `localhost:8080`; frontend
NGINX forwards to `gateway:8080`; Gateway routes `/api/v1/lessons` and query strings unchanged
to `vocabulary-api:8080`. Current proxy source forwards Authorization/If-Match and does not
hide ETag. Verify the **deployed** instances, not just source/build success. Cross-origin
overrides additionally need ETag exposure and If-Match permission in deployed CORS settings.

Backend imports default to 5 MiB/100 items and allow deployment configuration within
1–10 MiB and 1–500 items. The browser conservatively uses the defaults; changing deployment
limits alone does not change those frontend caps. Lower server limits still return errors.
NGINX body limits and multipart framing also apply. A 15-second frontend timeout can precede
completion behind the Gateway's 60-second upstream timeout; do not blindly retry.

Roles come from `/auth/me`, with memory-only tokens. Backend `Admin` authorization is decisive;
User/Admin can read lesson/content APIs, while writes/imports require Admin. A 403 must not
refresh tokens or clear the session. Existing shared 401 refresh behavior remains in effect.

## Automated verification

From the Angular directory:

```powershell
npm.cmd test -- --watch=false --include=src/app/features/admin/lessons/**/*.spec.ts --include=src/app/features/admin/imports/file-import.spec.ts --include=src/app/features/admin/admin.routes.spec.ts
npm.cmd test -- --watch=false
npx.cmd --no-install tsc --noEmit -p tsconfig.app.json
npx.cmd --no-install tsc --noEmit -p tsconfig.spec.json
npm.cmd run build
git diff --check
```

Run Prettier checks on changed files. Unit/component tests use controlled HTTP responses;
they do not prove deployed backend compatibility. Existing quiz live/e2e runners write data
and are not part of this grammar verification workflow.

## Manual live integration checklist

Only perform write steps with authorized Admin/User test accounts and disposable lessons.
This implementation session did not run live mutations or imports.

1. Verify health and deployment versions through the intended Gateway/frontend. Sign in as
   Admin; verify `/auth/me` reports `Admin`. Keep tokens out of logs/screenshots. Reloading
   loses the in-memory session and unsaved drafts, so export drafts before intentional reloads.
2. Open Lessons, switch N5–N1, and verify actual level IDs and backend display ordering.
   Check empty/loading/error states and that a fast level switch does not display stale data.
3. Choose unused lesson numbers/orders in an agreed test level. Create/edit metadata; reload
   its direct URL and verify persisted level ID/order, Unicode and nullable description.
   Try invalid/duplicate values. Do not assign real vocabulary, quizzes or learning history.
4. Open Content. Verify missing content offers an empty draft. Add all eight block types and
   all marks, Japanese/supplementary Unicode and Vietnamese; exercise list/table controls and
   block moves/removal. Preview must show text without interpreting HTML. Test size/field
   limits and unsaved navigation cancellation.
5. Save new content; inspect PUT version 0 and absent If-Match. Verify returned ETag/version.
   Edit/save again; inspect the exact quoted If-Match and current version, then the incremented
   response revision/new ETag. Direct GET must return the same document.
6. Open the same lesson in two authenticated tabs. Save tab A, then save stale tab B: expect
   409, retained dirty draft, disabled writes, working JSON export, and confirmed server reload.
   Optionally repeat after content deletion/recreation to check creation-identity ETags.
7. Delete content with confirmation/current version/ETag; metadata must remain. Recreate and
   save an empty document to confirm it differs from missing content. Check missing ETag and
   timeout handling with controlled browser request/header interception, not server changes.
8. Build a complete import file with unused test lesson keys/orders. In SKIP mode expect
   CREATED, repeat intentionally for SKIPPED, and confirm existing metadata/content unchanged.
   Test malformed JSON/UTF-8, unsupported schema, duplicate keys/orders and occupied-order
   preflight rejection; confirm rejected files made no writes.
9. For UPDATE mode, GET each test document's current revision/ETag and copy them exactly into
   the file. Verify UPDATED and persisted metadata/content. Include one deliberately stale
   revision with otherwise valid preflight data: expect FAILED for that item and committed
   successes for others. Confirm totals, indices and safe error detail rendering.
10. Simulate a network interruption/timeout on a disposable import. Expect unknown-outcome
    feedback and no automatic retry. Reconcile actual lessons before any intentional retry.
11. Open metadata-only import. Upload its separate levelId-based format with unused test
    lesson keys/orders. Verify the unchanged batch endpoint/report and navigation both ways.
12. Sign in as User and as Guest: every Admin lesson/import/content route must be blocked.
    With authorized test tooling, verify backend mutation/import requests using User tokens
    receive 403 while permitted reads succeed; ensure 403 preserves the session.
13. Delete only the IDs of disposable lessons created by this test, including partial-import
    successes and metadata-only fixtures. Confirm optional content cascades. If a test lesson
    is unexpectedly referenced, stop on 409 and investigate; never remove real assignments
    or bypass the deletion guard to force cleanup.

## Read-only readiness observation

During implementation, the local development containers were running. Unauthenticated GETs
returned Gateway `/health` 200, frontend `/health` 200, and Gateway `/api/v1/jlpt-levels` 401.
These checks establish reachability and an authentication boundary only. No authorized
browser session was supplied; live DTOs, ETags, CRUD/import transaction behavior, deployed
migrations, and current frontend bundle compatibility remain to be verified with the checklist.
