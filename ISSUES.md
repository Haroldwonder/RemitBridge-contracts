# RemitBridge GitHub Issues Backlog

This file contains 100 filed issues for the RemitBridge project, organized by difficulty. Each issue can be created in GitHub by copying the content into a new issue.

---

## Beginner Issues (50)

### #1 [BEGINNER] Add `email` field to org signup form

**Labels:** `good first issue`, `frontend`

The signup form (`frontend/src/pages/Signup.jsx`) does not include an `email` field. The backend now accepts `email` in `POST /api/orgs/signup`. Add the email input field to the form.

**Files:** `frontend/src/pages/Signup.jsx`  
**Effort:** ~1 hour

---

### #2 [BEGINNER] Add loading spinner to Recipients page

**Labels:** `good first issue`, `frontend`

The Recipients page (`frontend/src/pages/Recipients.jsx`) has no loading indicator. When the API call is in flight, show a spinner or "Loading…" message.

**Files:** `frontend/src/pages/Recipients.jsx`  
**Effort:** ~30 minutes

---

### #3 [BEGINNER] Add `country` filter to recipients list endpoint

**Labels:** `good first issue`, `backend`

`GET /api/recipients` supports `kyc_status` filtering. The DB schema has a `country` column. Wire up the `country` query parameter in `routes/recipients.js`. (Already implemented — needs a test!)

**Files:** `backend/tests/recipients.test.js`  
**Effort:** ~1 hour

---

### #4 [BEGINNER] Add health endpoint response to frontend footer

**Labels:** `good first issue`, `frontend`

The `GET /api/health` endpoint is available. Display the backend version and Stellar network in the Dashboard footer.

**Files:** `frontend/src/components/Layout.jsx`  
**Effort:** ~1 hour

---

### #5 [BEGINNER] Add `DELETE /api/recipients/:id` test

**Labels:** `good first issue`, `testing`

`DELETE /api/recipients/:id` is implemented with soft-delete. Add tests verifying: (a) 204 on success, (b) 404 for unknown recipient, (c) ensures `deleted_at=NOW()` query is used.

**Files:** `backend/tests/recipients.test.js`  
**Effort:** ~1 hour

---

### #6 [BEGINNER] Add `GET /api/health` test

**Labels:** `good first issue`, `testing`

The health endpoint has no test. Add a test file `backend/tests/health.test.js` that verifies: (a) 200 with `status: "ok"` when DB is reachable, (b) 503 when DB is unreachable.

**Files:** `backend/tests/health.test.js` (new file)  
**Effort:** ~1 hour

---

### #7 [BEGINNER] Show batch `type` label in Dashboard recent batches table

**Labels:** `good first issue`, `frontend`

The Dashboard recent batches table shows date, recipients, total, and status — but not the batch `type` (payroll / aid / disbursement). Add a Type column.

**Files:** `frontend/src/pages/Dashboard.jsx`  
**Effort:** ~30 minutes

---

### #8 [BEGINNER] Update `.env.example` with all new environment variables

**Labels:** `good first issue`, `docs`

`.env.example` only documents 3 variables. Add documentation for: `CORS_ORIGINS`, `STELLAR_NETWORK`, `TRUSTFLOW_API_URL`, `TRUSTFLOW_API_KEY`, `TRUSTFLOW_WEBHOOK_SECRET`, `FLOW_INDEXER_URL`, `FLOW_INDEXER_API_KEY`, `MINIMUM_TRUST_SCORE`.

**Files:** `.env.example`  
**Effort:** ~30 minutes

---

### #9 [BEGINNER] Add `memo` field display in BatchDetail page

**Labels:** `good first issue`, `frontend`

`batches` now has a `memo` field. Display it in `frontend/src/pages/BatchDetail.jsx` when present.

**Files:** `frontend/src/pages/BatchDetail.jsx`  
**Effort:** ~30 minutes

---

### #10 [BEGINNER] Add pagination controls to AuditTrail page

**Labels:** `good first issue`, `frontend`

`GET /api/audit` now supports `page` and `limit`. Add "Previous / Next" pagination buttons to `AuditTrail.jsx`. Default to `limit=20`.

**Files:** `frontend/src/pages/AuditTrail.jsx`  
**Effort:** ~2 hours

---

### #11 [BEGINNER] Validate `cron_expr` format in payroll schedule creation

**Labels:** `good first issue`, `backend`

`POST /api/payroll/schedules` accepts `cron_expr` as a string but doesn't validate it's valid cron syntax. Add a basic validation (regex or the `cron-parser` package).

**Files:** `backend/src/routes/payroll.js`  
**Effort:** ~1 hour

---

### #12 [BEGINNER] Add `Cancel batch` button to BatchDetail page

**Labels:** `good first issue`, `frontend`

`POST /api/batches/:id/cancel` is now available. Add a Cancel button on `BatchDetail.jsx` that is only shown when `status === 'pending' || status === 'awaiting_approval'`.

**Files:** `frontend/src/pages/BatchDetail.jsx`  
**Effort:** ~1 hour

---

### #13 [BEGINNER] Add 404 page to frontend

**Labels:** `good first issue`, `frontend`

The React app currently redirects all unknown routes to `/dashboard`. Create a proper 404 page component and wire it into `App.jsx` instead.

**Files:** `frontend/src/App.jsx`, `frontend/src/pages/NotFound.jsx` (new)  
**Effort:** ~1 hour

---

### #14 [BEGINNER] Display `kyc_status` badge on Recipients list

**Labels:** `good first issue`, `frontend`

Recipients now have a `kyc_status` field. Show a color-coded badge (green=approved, yellow=pending, red=rejected) in the recipients table.

**Files:** `frontend/src/pages/Recipients.jsx`  
**Effort:** ~1 hour

---

### #15 [BEGINNER] Add input length validation to recipient `name`

**Labels:** `good first issue`, `backend`

`name` has no max-length validation. Add a 255-character limit check in `POST /api/recipients` and `PUT /api/recipients/:id`.

**Files:** `backend/src/routes/recipients.js`  
**Effort:** ~30 minutes

---

### #16 [BEGINNER] Add `country` column to recipients CSV export

**Labels:** `good first issue`, `backend`

The batch CSV export (`GET /api/audit/:batchId/export`) does not include the recipient's country. Add it as a column.

**Files:** `backend/src/routes/audit.js`  
**Effort:** ~30 minutes

---

### #17 [BEGINNER] Add `type` filter to `GET /api/audit`

**Labels:** `good first issue`, `backend`

The audit endpoint now accepts a `type` query param. Add a test for this filter in `tests/batches.test.js` or a new `tests/audit.test.js`.

**Files:** `backend/tests/audit.test.js` (new)  
**Effort:** ~1 hour

---

### #18 [BEGINNER] Document all event types in `EventSchemas.js` with JSDoc

**Labels:** `good first issue`, `docs`

`EventSchemas.js` has no comments explaining when each event is emitted. Add JSDoc comments to each schema factory method.

**Files:** `backend/src/events/EventSchemas.js`  
**Effort:** ~1 hour

---

### #19 [BEGINNER] Add `recipient_count` to payroll schedule detail

**Labels:** `good first issue`, `backend`

`GET /api/payroll/schedules/:id` returns the schedule but not how many recipients are currently configured for it. Add a `recipient_count` derived field.

**Files:** `backend/src/routes/payroll.js`  
**Effort:** ~1 hour

---

### #20 [BEGINNER] Add `program_type` badge to aid programs list in frontend

**Labels:** `good first issue`, `frontend`

Create an Aid Programs page (or add it to Dashboard) that lists programs with their `program_type` displayed as a badge (cash, voucher, emergency, recurring).

**Files:** `frontend/src/pages/AidPrograms.jsx` (new), `frontend/src/App.jsx`  
**Effort:** ~2 hours

---

### #21 [BEGINNER] Test `POST /api/orgs/login` happy path

**Labels:** `good first issue`, `testing`

`POST /api/orgs/login` has no test. Add a test in `tests/orgs.test.js` covering: (a) successful login returns token, (b) wrong password returns 401, (c) unknown org returns 401.

**Files:** `backend/tests/orgs.test.js` (new)  
**Effort:** ~1 hour

---

### #22 [BEGINNER] Test `GET /api/orgs/me`

**Labels:** `good first issue`, `testing`

Add a test for `GET /api/orgs/me` in `tests/orgs.test.js`: (a) returns org data for valid token, (b) 401 without token.

**Files:** `backend/tests/orgs.test.js`  
**Effort:** ~30 minutes

---

### #23 [BEGINNER] Add `STELLAR_EXPLORER_BASE_URL` env var for testnet/mainnet links

**Labels:** `good first issue`, `frontend`

`BatchDetail.jsx` hardcodes `https://stellar.expert/explorer/testnet/tx/`. Replace with an env variable so the same build can link to mainnet.

**Files:** `frontend/src/pages/BatchDetail.jsx`, `.env.example`  
**Effort:** ~30 minutes

---

### #24 [BEGINNER] Add tooltip to fee estimate in New Batch preview

**Labels:** `good first issue`, `frontend`

The "Estimated fee" in the batch preview shows XLM but users may not understand what this means. Add a tooltip: "Stellar network fee paid by your org wallet."

**Files:** `frontend/src/pages/NewBatch.jsx`  
**Effort:** ~30 minutes

---

### #25 [BEGINNER] Add a `GET /api/payroll/schedules/:id` test

**Labels:** `good first issue`, `testing`

Add test coverage for `GET /api/payroll/schedules/:id`: (a) returns schedule when found, (b) 404 when not found or wrong org.

**Files:** `backend/tests/payroll.test.js`  
**Effort:** ~30 minutes

---

### #26 [BEGINNER] Add `PATCH /api/payroll/schedules/:id` test

**Labels:** `good first issue`, `testing`

Add tests for schedule update: (a) updates name successfully, (b) deactivates schedule, (c) 404 for unknown id.

**Files:** `backend/tests/payroll.test.js`  
**Effort:** ~30 minutes

---

### #27 [BEGINNER] Export beneficiary group members as CSV

**Labels:** `good first issue`, `backend`

Add `GET /api/aid/groups/:id/export` that downloads group members as CSV (name, stellar_address, country, kyc_status).

**Files:** `backend/src/routes/aid.js`  
**Effort:** ~1 hour

---

### #28 [BEGINNER] Add `total_members` to beneficiary group list endpoint

**Labels:** `good first issue`, `backend`

`GET /api/aid/groups` already returns `member_count`. Rename it to `total_members` for API consistency. Update the query and test.

**Files:** `backend/src/routes/aid.js`, `backend/tests/aid.test.js`  
**Effort:** ~30 minutes

---

### #29 [BEGINNER] Add page title `<title>` tags per route

**Labels:** `good first issue`, `frontend`

The frontend has a single `<title>RemitBridge</title>`. Update the document title dynamically per page (e.g. "Dashboard — RemitBridge", "New Batch — RemitBridge").

**Files:** `frontend/src/pages/*.jsx`  
**Effort:** ~1 hour

---

### #30 [BEGINNER] Add `budget_remaining` computed field to aid program detail

**Labels:** `good first issue`, `backend`

`GET /api/aid/programs/:id` returns `budget_total` and `budget_spent`. Add a derived `budget_remaining` field in the response.

**Files:** `backend/src/routes/aid.js`  
**Effort:** ~30 minutes

---

### #31 [BEGINNER] Add `aid_program_id` filter to `GET /api/aid/groups`

**Labels:** `good first issue`, `backend`

Allow filtering beneficiary groups by program: `GET /api/aid/groups?aid_program_id=3`.

**Files:** `backend/src/routes/aid.js`  
**Effort:** ~30 minutes

---

### #32 [BEGINNER] Add `status` field to TrustFlow allocations list response

**Labels:** `good first issue`, `backend`

`GET /api/trustflow/allocations` returns DB rows directly. Add a human-readable `status_label` field (e.g. "Active — expires in 30 days").

**Files:** `backend/src/routes/trustflow.js`  
**Effort:** ~30 minutes

---

### #33 [BEGINNER] Write test for `TrustFlowAdapter.adaptFundingStream`

**Labels:** `good first issue`, `testing`

`tests/trustflow.test.js` does not test `adaptFundingStream`. Add a test verifying the mapping of all fields.

**Files:** `backend/tests/trustflow.test.js`  
**Effort:** ~30 minutes

---

### #34 [BEGINNER] Add `X-Request-ID` response header

**Labels:** `good first issue`, `backend`

Generate a UUID request ID in middleware and attach it to the response as `X-Request-ID`. Log it with each request. Useful for debugging.

**Files:** `backend/src/index.js`  
**Effort:** ~1 hour

---

### #35 [BEGINNER] Add `Content-Security-Policy` header to frontend

**Labels:** `good first issue`, `frontend`, `security`

Configure a CSP header in `vite.config.js` or the Nginx config to prevent XSS.

**Files:** `frontend/vite.config.js`  
**Effort:** ~1 hour

---

### #36 [BEGINNER] Add `.gitignore` entry for `coverage/`

**Labels:** `good first issue`, `chore`

Jest coverage output goes to `backend/coverage/` but it's not in `.gitignore`. Add it.

**Files:** `.gitignore`  
**Effort:** ~5 minutes

---

### #37 [BEGINNER] Add `PATCH /api/aid/programs/:id` test

**Labels:** `good first issue`, `testing`

Add tests for `PATCH /api/aid/programs/:id`: (a) updates name and active flag, (b) 404 for wrong org.

**Files:** `backend/tests/aid.test.js`  
**Effort:** ~30 minutes

---

### #38 [BEGINNER] Show `aid_program` name in batch list for aid-type batches

**Labels:** `good first issue`, `backend`

`GET /api/batches` returns `aid_program_id` but not the program name. JOIN `aid_programs` and include `aid_program_name` in the response.

**Files:** `backend/src/routes/batches.js`  
**Effort:** ~1 hour

---

### #39 [BEGINNER] Add `require_approval` display to Dashboard batch table

**Labels:** `good first issue`, `frontend`

Batches in `awaiting_approval` status should display differently from `pending`. Add a visual indicator or badge.

**Files:** `frontend/src/pages/Dashboard.jsx`  
**Effort:** ~30 minutes

---

### #40 [BEGINNER] Document `docker-compose.yml` services in README

**Labels:** `good first issue`, `docs`

The README's Development section mentions Docker Compose but doesn't explain the services. Add a table: service, port, purpose.

**Files:** `README.md`  
**Effort:** ~30 minutes

---

### #41 [BEGINNER] Add `GET /api/compliance/audit-trail` test

**Labels:** `good first issue`, `testing`

`GET /api/compliance/audit-trail` is implemented but untested. Add tests.

**Files:** `backend/tests/compliance.test.js`  
**Effort:** ~30 minutes

---

### #42 [BEGINNER] Add `phone` column to CSV export

**Labels:** `good first issue`, `backend`

The recipient CSV export includes email but not phone. Add phone to the export.

**Files:** `backend/src/routes/audit.js`  
**Effort:** ~15 minutes

---

### #43 [BEGINNER] Fix currency display on Dashboard — show per-currency totals

**Labels:** `good first issue`, `frontend`

Dashboard shows `$` prefix regardless of currency. Sum `total_amount` per currency and display "X USDC + Y PYUSD" instead.

**Files:** `frontend/src/pages/Dashboard.jsx`  
**Effort:** ~1 hour

---

### #44 [BEGINNER] Add `limit` header to rate limiter response

**Labels:** `good first issue`, `backend`

The rate limiter returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Document these headers in `API.md`.

**Files:** `API.md`  
**Effort:** ~15 minutes

---

### #45 [BEGINNER] Add `soroban-sdk` version badge to README

**Labels:** `good first issue`, `docs`

The README has Stellar and license badges but no Soroban/Rust badge. Add `soroban-sdk = 21.0.0` badge.

**Files:** `README.md`  
**Effort:** ~15 minutes

---

### #46 [BEGINNER] Test `GET /api/analytics/anchor-usage`

**Labels:** `good first issue`, `testing`

Add a test for the anchor usage analytics endpoint.

**Files:** `backend/tests/analytics.test.js`  
**Effort:** ~30 minutes

---

### #47 [BEGINNER] Add error boundary to React app

**Labels:** `good first issue`, `frontend`

An unhandled JS error crashes the entire app with a white screen. Wrap the router in an `ErrorBoundary` component that shows a friendly error message.

**Files:** `frontend/src/App.jsx`, `frontend/src/components/ErrorBoundary.jsx` (new)  
**Effort:** ~1 hour

---

### #48 [BEGINNER] Add `PATCH /api/orgs/me` test

**Labels:** `good first issue`, `testing`

Test the profile update endpoint.

**Files:** `backend/tests/orgs.test.js`  
**Effort:** ~30 minutes

---

### #49 [BEGINNER] Add `docker-compose.override.yml` example for local development

**Labels:** `good first issue`, `devex`

Create a sample `docker-compose.override.yml` that mounts local source and enables hot-reload for faster development iteration.

**Files:** `docker-compose.override.yml.example` (new)  
**Effort:** ~30 minutes

---

### #50 [BEGINNER] Add `CHANGELOG.md`

**Labels:** `good first issue`, `docs`

Create a `CHANGELOG.md` documenting the v1.0 and v1.1 releases.

**Files:** `CHANGELOG.md` (new)  
**Effort:** ~30 minutes

---

## Intermediate Issues (25)

### #51 [INTERMEDIATE] Implement Redis-backed rate limiting

**Labels:** `help wanted`, `backend`, `performance`

The current in-memory rate limiter doesn't work across multiple instances. Integrate `rate-limiter-flexible` with a Redis backend. Keep the in-memory fallback for dev.

**Files:** `backend/src/middleware/rateLimiter.js`  
**Effort:** ~4 hours

---

### #52 [INTERMEDIATE] Implement webhook signature verification (HMAC-SHA256)

**Labels:** `help wanted`, `backend`, `security`

`routes/webhooks.js` has a `verifySecret` placeholder. Implement proper HMAC-SHA256 verification of the request body against the signature header. Include timing-safe comparison.

**Files:** `backend/src/routes/webhooks.js`  
**Effort:** ~3 hours

---

### #53 [INTERMEDIATE] Add cursor-based pagination to `GET /api/batches`

**Labels:** `help wanted`, `backend`

Page-based pagination works but cursor-based pagination is more efficient for large datasets. Add a `cursor` query param (last `id` seen) as an alternative to `page`.

**Files:** `backend/src/routes/batches.js`  
**Effort:** ~3 hours

---

### #54 [INTERMEDIATE] Build Aid Programs management page in frontend

**Labels:** `help wanted`, `frontend`

Create a full-featured Aid Programs page (`/aid/programs`) with: list programs, create new program, view program detail, see beneficiary groups per program, and trigger a disbursement.

**Files:** `frontend/src/pages/AidPrograms.jsx`, `frontend/src/App.jsx`  
**Effort:** ~6 hours

---

### #55 [INTERMEDIATE] Build Payroll Schedules management page in frontend

**Labels:** `help wanted`, `frontend`

Create a Payroll Schedules page (`/payroll/schedules`) with: list schedules, create, edit (deactivate), and view batches per schedule.

**Files:** `frontend/src/pages/PayrollSchedules.jsx`, `frontend/src/App.jsx`  
**Effort:** ~6 hours

---

### #56 [INTERMEDIATE] Implement `EventPublisher` transaction integration

**Labels:** `help wanted`, `backend`

Currently `eventPublisher.publish` uses the shared pool. For true atomicity, it should accept a PostgreSQL transaction client and write within the same transaction as the mutation. Refactor the signature and update callers.

**Files:** `backend/src/events/EventPublisher.js`, `backend/src/routes/*.js`  
**Effort:** ~4 hours

---

### #57 [INTERMEDIATE] Add `GET /api/analytics/volume` chart to Dashboard

**Labels:** `help wanted`, `frontend`

Integrate a chart library (recharts or chart.js) and display the payment volume over time on the Dashboard.

**Files:** `frontend/src/pages/Dashboard.jsx`  
**Effort:** ~4 hours

---

### #58 [INTERMEDIATE] Add compliance status check before batch submission

**Labels:** `help wanted`, `backend`

Before `POST /api/batches/:id/submit`, automatically run the compliance screen (`/compliance/screen`) and block submission if `clearance === 'blocked'`.

**Files:** `backend/src/routes/batches.js`  
**Effort:** ~3 hours

---

### #59 [INTERMEDIATE] Implement `TrustFlowProvider` circuit breaker

**Labels:** `help wanted`, `backend`, `reliability`

If TrustFlow is unreachable 3 times in a row, open a circuit breaker that stops making calls for 60 seconds and serves cached data or fails gracefully.

**Files:** `backend/src/integrations/trustflow/TrustFlowProvider.js`  
**Effort:** ~4 hours

---

### #60 [INTERMEDIATE] Add `GET /api/recipients/export` CSV endpoint

**Labels:** `help wanted`, `backend`

Allow bulk export of all recipients for an org as a CSV, optionally filtered by `country` and `kyc_status`.

**Files:** `backend/src/routes/recipients.js`  
**Effort:** ~2 hours

---

### #61 [INTERMEDIATE] Wire `STELLAR_NETWORK` env var to use mainnet Horizon

**Labels:** `help wanted`, `backend`

`services/stellar.js` hardcodes testnet Horizon URL. Read `STELLAR_NETWORK` from env and switch to mainnet URLs (`https://horizon.stellar.org`, `StellarSdk.Networks.PUBLIC`).

**Files:** `backend/src/services/stellar.js`  
**Effort:** ~2 hours

---

### #62 [INTERMEDIATE] Add batch status polling with WebSocket fallback

**Labels:** `help wanted`, `frontend`

Replace `setInterval` polling in `NewBatch.jsx` with a `EventSource` (SSE) endpoint that pushes status updates. Fall back to polling if SSE is unavailable.

**Files:** `backend/src/routes/batches.js`, `frontend/src/pages/NewBatch.jsx`  
**Effort:** ~5 hours

---

### #63 [INTERMEDIATE] Implement `DELETE /api/aid/programs/:id` (soft delete)

**Labels:** `help wanted`, `backend`

Aid programs don't have a delete endpoint. Add soft-delete (set `active=false`, don't allow re-activation if batches ran).

**Files:** `backend/src/routes/aid.js`, `backend/tests/aid.test.js`  
**Effort:** ~2 hours

---

### #64 [INTERMEDIATE] Add analytics time-series chart for TrustFlow allocation intake

**Labels:** `help wanted`, `frontend`

Display a timeline of when allocations were synced and consumed on a dedicated TrustFlow page.

**Files:** `frontend/src/pages/TrustFlow.jsx` (new)  
**Effort:** ~5 hours

---

### #65 [INTERMEDIATE] Refactor batch submission to use `pg-boss` job queue

**Labels:** `help wanted`, `backend`, `reliability`

The current fire-and-forget async closure can't retry on server crash. Replace with a `pg-boss` job that persists the job in the DB and processes it reliably.

**Files:** `backend/src/services/stellar.js`, `backend/src/routes/batches.js`  
**Effort:** ~6 hours

---

### #66 [INTERMEDIATE] Add integration tests for TrustFlow webhook receiver

**Labels:** `help wanted`, `testing`

`POST /api/webhooks/trustflow` is untested. Add integration tests for each handled event type.

**Files:** `backend/tests/webhooks.test.js` (new)  
**Effort:** ~3 hours

---

### #67 [INTERMEDIATE] Add full test for `FundingAllocationService.syncAllocations`

**Labels:** `help wanted`, `testing`

`FundingAllocationService` has no tests. Mock the provider and add tests for `syncAllocations` and `consumeAllocation`.

**Files:** `backend/tests/fundingAllocation.test.js` (new)  
**Effort:** ~3 hours

---

### #68 [INTERMEDIATE] Add `GET /api/analytics/summary` caching layer

**Labels:** `help wanted`, `backend`, `performance`

The summary endpoint runs 4 aggregation queries on every call. Add a 60-second in-memory cache (or Redis TTL key) to reduce DB load.

**Files:** `backend/src/routes/analytics.js`  
**Effort:** ~3 hours

---

### #69 [INTERMEDIATE] Build Compliance Dashboard page

**Labels:** `help wanted`, `frontend`

Create a Compliance page listing KYC status per recipient and allowing filtering by status, with a drill-down to compliance history.

**Files:** `frontend/src/pages/Compliance.jsx` (new)  
**Effort:** ~5 hours

---

### #70 [INTERMEDIATE] Add `E2E` test for batch creation → submission flow

**Labels:** `help wanted`, `testing`

Write an end-to-end integration test (Supertest + mocked Stellar) that creates a batch, submits it, polls for completion, and verifies the event outbox is populated.

**Files:** `backend/tests/e2e.test.js` (new)  
**Effort:** ~5 hours

---

### #71 [INTERMEDIATE] Implement budget depletion alert event

**Labels:** `help wanted`, `backend`

When an aid program's budget reaches 90% spent, emit a `remitbridge.aid.budget_warning` event with remaining amount. Add to `EventSchemas.js`.

**Files:** `backend/src/routes/aid.js`, `backend/src/events/EventSchemas.js`  
**Effort:** ~2 hours

---

### #72 [INTERMEDIATE] Add `minimum_amount` and `maximum_amount` to aid programs

**Labels:** `help wanted`, `backend`

Allow NGOs to configure per-recipient payment bounds. Validate in `disburse` endpoint.

**Files:** `backend/src/db.js`, `backend/src/routes/aid.js`  
**Effort:** ~3 hours

---

### #73 [INTERMEDIATE] Add JWT refresh token flow

**Labels:** `help wanted`, `backend`, `security`

JWTs expire after 7 days with no refresh mechanism. Add a `POST /api/orgs/refresh` endpoint that accepts a valid token and returns a new one with a reset 7-day window.

**Files:** `backend/src/routes/orgs.js`  
**Effort:** ~3 hours

---

### #74 [INTERMEDIATE] Add `GET /api/recipients/:id/payments` endpoint

**Labels:** `help wanted`, `backend`

Return all payments sent to a specific recipient, across batches, with pagination.

**Files:** `backend/src/routes/recipients.js`  
**Effort:** ~2 hours

---

### #75 [INTERMEDIATE] Add structured error logging with request context

**Labels:** `help wanted`, `backend`, `observability`

The global error handler logs `err.message`. Extend it to log: request ID, method, path, org ID (if available), and a redacted body. Consider using Pino.

**Files:** `backend/src/index.js`  
**Effort:** ~3 hours

---

## Advanced Issues (25)

### #76 [ADVANCED] Wire Soroban compliance contract to backend batch flow

**Labels:** `advanced`, `contracts`

`contracts/compliance/src/lib.rs` provides `log_disbursement` and `clawback` but neither is called from the backend. Wire them: call `log_disbursement` after successful batch settlement, and `clawback` from the batch clawback endpoint. Requires `soroban-client` or Horizon's invoke contract.

**Files:** `backend/src/services/stellar.js`, `backend/src/routes/batches.js`  
**Effort:** ~10 hours

---

### #77 [ADVANCED] Implement SEP-24 Anchor withdrawal flow

**Labels:** `advanced`, `backend`

Replace the hardcoded FX simulation in `AnchorModal.jsx` with a real SEP-24 interactive withdrawal flow. This requires: (1) SEP-1 discovery, (2) SEP-24 interactive flow initiation, (3) polling withdrawal status.

**Files:** `backend/src/services/anchor.js` (new), `frontend/src/components/AnchorModal.jsx`  
**Effort:** ~16 hours

---

### #78 [ADVANCED] Implement auto-execution engine for scheduled payrolls

**Labels:** `advanced`, `backend`

`payroll_schedules` has `cron_expr` but no execution engine. Build a cron runner (using `node-cron` or `pg-boss` scheduled jobs) that: (1) finds due schedules, (2) creates a batch from their linked recipients, (3) submits or queues for approval.

**Files:** `backend/src/services/payrollEngine.js` (new)  
**Effort:** ~12 hours

---

### #79 [ADVANCED] Replace in-memory rate limiter with Redis

**Labels:** `advanced`, `backend`, `infrastructure`

Implement Redis-backed sliding window rate limiting using `ioredis`. Ensure the fallback to in-memory still works if Redis is unavailable (fail open for rate limiting).

**Files:** `backend/src/middleware/rateLimiter.js`  
**Effort:** ~6 hours

---

### #80 [ADVANCED] Implement multi-tenant role-based access control (RBAC)

**Labels:** `advanced`, `backend`, `security`

Currently all org members share the same permissions. Design and implement RBAC: (1) `org_users` table with roles (admin, payroll_manager, viewer), (2) JWT includes role, (3) middleware enforces role per route.

**Files:** `backend/src/db.js`, `backend/src/middleware/rbac.js` (new)  
**Effort:** ~16 hours

---

### #81 [ADVANCED] Implement event schema versioning and migration

**Labels:** `advanced`, `backend`

Events in `events_outbox` use `event_version: '1.0'`. As schemas evolve, FlowIndexer needs to handle multiple versions. Design a versioned schema registry and a migration strategy. Implement v2 of the `payroll.executed` event.

**Files:** `backend/src/events/EventSchemas.js`, `backend/src/events/SchemaRegistry.js` (new)  
**Effort:** ~8 hours

---

### #82 [ADVANCED] Build `@opentrust/remitbridge-client` npm package

**Labels:** `advanced`, `sdk`

Create a TypeScript npm package exposing a clean client for all RemitBridge APIs, matching the interface style of the future TrustFlow and FlowIndexer SDK clients.

**Files:** `sdk/` (new directory)  
**Effort:** ~20 hours

---

### #83 [ADVANCED] Implement Chainalysis sanctions screening integration

**Labels:** `advanced`, `backend`, `compliance`

Add a real sanctions screening provider: call Chainalysis (or a mock) for each new Stellar address added. Store results in `compliance_records` with `check_type='sanctions'`. Emit events.

**Files:** `backend/src/services/SanctionsService.js` (new)  
**Effort:** ~8 hours

---

### #84 [ADVANCED] Implement on-chain disbursement proofs with Soroban

**Labels:** `advanced`, `contracts`

Design a new `DisbursementProof` Soroban contract that stores a Merkle root of all payments in a batch. This allows recipients to prove they received a payment without revealing other recipients.

**Files:** `contracts/disbursement-proof/` (new)  
**Effort:** ~20 hours

---

### #85 [ADVANCED] Add real-time batch status updates via Server-Sent Events (SSE)

**Labels:** `advanced`, `backend`, `frontend`

Implement `GET /api/batches/:id/stream` as a Server-Sent Events endpoint that pushes payment status updates as they complete. Replace the polling loop in the frontend.

**Files:** `backend/src/routes/batches.js`, `frontend/src/pages/NewBatch.jsx`  
**Effort:** ~8 hours

---

### #86 [ADVANCED] Implement FlowIndexer delivery with dead letter queue

**Labels:** `advanced`, `backend`

After 5 failed delivery attempts, move events to a `events_dead_letter` table. Add `POST /api/admin/events/retry` to re-queue dead-letter events. Add monitoring endpoint.

**Files:** `backend/src/events/FlowIndexerPublisher.js`, `backend/src/db.js`  
**Effort:** ~6 hours

---

### #87 [ADVANCED] Implement Stellar streaming for transaction confirmation

**Labels:** `advanced`, `backend`

Instead of fire-and-forget + polling, use Stellar's event streaming API (`/payments`, `/transactions`) to receive real-time confirmation of submitted transactions and update payment statuses.

**Files:** `backend/src/services/stellar.js`  
**Effort:** ~10 hours

---

### #88 [ADVANCED] Add EURC (Euro stablecoin) support

**Labels:** `advanced`, `backend`, `frontend`

Add EURC as a third supported currency. This requires: (1) EURC asset definition in `stellar.js`, (2) currency validation updates, (3) FX rate display in AnchorModal, (4) frontend currency selector.

**Files:** `backend/src/services/stellar.js`, `backend/src/routes/batches.js`, `frontend/`  
**Effort:** ~6 hours

---

### #89 [ADVANCED] Build OpenTelemetry distributed tracing

**Labels:** `advanced`, `backend`, `observability`

Instrument the backend with OpenTelemetry: (1) trace all HTTP requests, (2) trace all DB queries, (3) trace Stellar Horizon calls, (4) trace FlowIndexer event delivery. Export to Jaeger or OTLP.

**Files:** `backend/src/tracing.js` (new), `backend/src/index.js`  
**Effort:** ~10 hours

---

### #90 [ADVANCED] Implement `pg-boss` for reliable Stellar batch submission

**Labels:** `advanced`, `backend`, `reliability`

Replace the detached async closure in `batches.js:submit` with a `pg-boss` job. The job: picks up the batch ID, runs Stellar submission, handles retries, updates status. Expose job queue health in `/api/health`.

**Files:** `backend/src/services/jobQueue.js` (new), `backend/src/routes/batches.js`  
**Effort:** ~12 hours

---

### #91 [ADVANCED] Design and implement DB migration system

**Labels:** `advanced`, `backend`, `infrastructure`

Replace `initDb()` raw DDL with a migration runner (Flyway, `node-pg-migrate`, or custom). Each schema change becomes a numbered migration file. Track applied migrations in a `schema_migrations` table.

**Files:** `backend/src/db.js`, `backend/migrations/` (new)  
**Effort:** ~8 hours

---

### #92 [ADVANCED] Build beneficiary self-service portal

**Labels:** `advanced`, `frontend`

Create a separate lightweight React app (or route) where beneficiaries log in with their Stellar address (SEP-10 auth) and view their payment history and pending disbursements.

**Files:** `frontend-beneficiary/` (new app)  
**Effort:** ~24 hours

---

### #93 [ADVANCED] Implement FX rate oracle integration

**Labels:** `advanced`, `backend`

Integrate real FX rates for the AnchorModal simulation. Options: Stellar DEX (via Horizon), Redstone Oracle, or open exchange rate API. Cache rates with TTL.

**Files:** `backend/src/services/FxRateService.js` (new)  
**Effort:** ~8 hours

---

### #94 [ADVANCED] Add multi-signature M-of-N approval for payroll

**Labels:** `advanced`, `backend`

The current approval system checks `approved_count >= min_approvals` but approvers are not pre-configured. Design: (1) `payroll_approvers` table linking approver emails to schedules, (2) enforce only pre-configured approvers can approve, (3) require M of N.

**Files:** `backend/src/db.js`, `backend/src/routes/payroll.js`  
**Effort:** ~10 hours

---

### #95 [ADVANCED] Implement TrustFlow reputation score sync for all recipients

**Labels:** `advanced`, `backend`

Build a background sync job that: (1) fetches all recipients with a non-null TrustFlow ID, (2) calls `TrustScoreService.syncRecipientTrustScore`, (3) updates `recipients.trust_score`. Run daily.

**Files:** `backend/src/jobs/trustScoreSync.js` (new)  
**Effort:** ~6 hours

---

### #96 [ADVANCED] Implement programmable disbursement rules engine

**Labels:** `advanced`, `backend`

Allow NGOs to define rules like: "Hold 10% in escrow for 30 days", "Max $500/recipient/month", "Only disburse if KYC status = approved". Design a rules DSL and enforcement middleware.

**Files:** `backend/src/services/RulesEngine.js` (new)  
**Effort:** ~16 hours

---

### #97 [ADVANCED] Extend Soroban contract to support KYC records on-chain

**Labels:** `advanced`, `contracts`

Design a `KYCRecord` struct in the compliance contract that stores: recipient address, KYC status, issuer address, timestamp. Only the admin can write; anyone can read.

**Files:** `contracts/compliance/src/lib.rs`  
**Effort:** ~8 hours

---

### #98 [ADVANCED] Build automated cross-ecosystem testing harness

**Labels:** `advanced`, `testing`

Build an integration testing harness that: (1) mocks TrustFlow API, (2) stands up RemitBridge, (3) runs a full allocation → disbursement → FlowIndexer event flow, (4) asserts all events were delivered correctly.

**Files:** `tests/integration/` (new directory)  
**Effort:** ~16 hours

---

### #99 [ADVANCED] Implement Stellar Turrets for non-custodial batch signing

**Labels:** `advanced`, `backend`, `security`

Instead of accepting a raw secret key from the client, integrate with Stellar Turrets (or Stellar's signing service) to enable non-custodial batch signing without the secret key ever leaving the client.

**Files:** `backend/src/services/stellar.js`  
**Effort:** ~20 hours

---

### #100 [ADVANCED] Design and build cross-border tax withholding module

**Labels:** `advanced`, `backend`, `compliance`

For employer payrolls, add jurisdiction-aware tax withholding: (1) tax rate table per country, (2) auto-withhold percentage from gross pay, (3) generate withholding reports, (4) emit tax events to FlowIndexer.

**Files:** `backend/src/services/TaxService.js` (new), `backend/src/db.js`  
**Effort:** ~24 hours

---

*Total issues: 50 beginner + 25 intermediate + 25 advanced = **100 issues***
