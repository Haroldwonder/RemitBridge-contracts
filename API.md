# RemitBridge API Reference

**Base URL:** `http://localhost:4000/api`  
**Auth:** `Authorization: Bearer <jwt>` on all endpoints except those marked public.

---

## Organizations

### POST /api/orgs/signup `public`

Register a new organization. Generates a Stellar keypair and funds it via Friendbot (testnet).

**Body:**
```json
{
  "name": "Acme NGO",
  "email": "ops@acme.org",
  "country": "KE",
  "use_case": "ngo",
  "password": "securepassword"
}
```
`use_case`: `ngo` | `employer` | `remittance`

**Response 201:**
```json
{
  "org": { "id": 1, "name": "Acme NGO", "country": "KE", "stellar_public_key": "G..." },
  "token": "<jwt>",
  "secretKey": "S...",
  "warning": "Save your secret key — it will not be shown again."
}
```

---

### POST /api/orgs/login `public`

**Body:** `{ "name": "Acme NGO", "password": "..." }`  
**Response 200:** `{ "token": "<jwt>", "org": { ... } }`

---

### GET /api/orgs/me

Returns the authenticated org's profile.

---

### PATCH /api/orgs/me

Update org email or country.

---

## Recipients

### GET /api/recipients

**Query params:** `page`, `limit`, `search`, `kyc_status`, `country`

---

### POST /api/recipients

**Body:**
```json
{ "name": "Alice Wanjiku", "email": "alice@example.com", "stellar_address": "G...", "phone": "+254700000000", "country": "KE" }
```

---

### GET /api/recipients/:id

---

### PUT /api/recipients/:id

Partial update — all fields optional.

---

### DELETE /api/recipients/:id

Soft delete (sets `deleted_at`). Payment history is preserved.

---

### POST /api/recipients/csv

Upload a CSV file with columns: `name, email, stellar_address, phone, country`.  
Max 500 rows, max 5MB.

**Response:** `{ "inserted": 47, "errors": [{ "row": 3, "error": "..." }] }`

---

## Batches

### POST /api/batches

Create a disbursement batch (preview mode — does not submit to Stellar).

**Body:**
```json
{
  "currency": "USDC",
  "type": "payroll",
  "memo": "July 2026 payroll",
  "require_approval": false,
  "payments": [
    { "recipient_id": 1, "stellar_address": "G...", "amount": "500.00" },
    { "stellar_address": "G...", "amount": "750.00" }
  ]
}
```

**Response 201:**
```json
{
  "batch": { "id": 42, "status": "pending", "total_amount": "1250.00", "currency": "USDC" },
  "fee_xlm": "0.0000200",
  "total": 1250
}
```

---

### POST /api/batches/:id/submit

Submit a pending batch to Stellar. Responds immediately; poll for status.

**Body:** `{ "secret_key": "S..." }`  
**Response 200:** `{ "batch_id": 42, "message": "Submission started" }`

---

### GET /api/batches

**Query params:** `page`, `limit`, `status`, `type`, `currency`

---

### GET /api/batches/:id

Returns batch with full payment list.

---

### POST /api/batches/:id/clawback

Claw back a payment within 48 hours.

**Body:** `{ "payment_index": 0 }`

---

### POST /api/batches/:id/cancel

Cancel a `pending` or `awaiting_approval` batch.

---

## Payroll

### GET /api/payroll/schedules

List recurring payroll schedules.

---

### POST /api/payroll/schedules

**Body:**
```json
{
  "name": "Monthly Staff Payroll",
  "currency": "USDC",
  "cron_expr": "0 0 1 * *",
  "require_approval": true,
  "min_approvals": 2
}
```

---

### GET /api/payroll/schedules/:id

---

### PATCH /api/payroll/schedules/:id

---

### DELETE /api/payroll/schedules/:id

Deactivates (sets `active=false`).

---

### GET /api/payroll/batches

**Query params:** `page`, `limit`, `status`, `currency`

---

### POST /api/payroll/batches/:id/approve

Approve a payroll batch that is `awaiting_approval`.

**Body:** `{ "note": "CFO approved Q3 payroll", "approver_email": "cfo@acme.org" }`

---

### POST /api/payroll/batches/:id/reject

Reject and cancel a batch.

---

## Aid Programs

### GET /api/aid/programs

**Query params:** `page`, `limit`, `active`

---

### POST /api/aid/programs

**Body:**
```json
{
  "name": "Kenya Food Security 2026",
  "description": "Monthly cash transfers to food-insecure households",
  "program_type": "cash",
  "country": "KE",
  "region": "Turkana County",
  "budget_total": 500000,
  "currency": "USDC",
  "starts_at": "2026-07-01T00:00:00Z",
  "ends_at": "2026-12-31T00:00:00Z"
}
```
`program_type`: `cash` | `voucher` | `emergency` | `recurring`

---

### GET /api/aid/programs/:id

---

### PATCH /api/aid/programs/:id

---

### GET /api/aid/groups

---

### POST /api/aid/groups

**Body:**
```json
{ "name": "Turkana Group A", "aid_program_id": 3, "country": "KE", "region": "Turkana" }
```

---

### GET /api/aid/groups/:id/members

---

### POST /api/aid/groups/:id/members

**Body:** `{ "recipient_ids": [10, 11, 12, 13] }`

---

### DELETE /api/aid/groups/:id/members/:recipientId

---

### POST /api/aid/programs/:id/disburse

Create a batch for all eligible members of a beneficiary group.

**Body:**
```json
{ "group_id": 5, "amount_per_recipient": "100.00", "currency": "USDC" }
```

**Response 201:**
```json
{ "batch": { ... }, "payment_count": 47, "total": 4700 }
```

---

## Compliance

### GET /api/compliance/checks

**Query params:** `page`, `limit`, `check_type`, `status`, `recipient_id`

---

### POST /api/compliance/checks

Record the result of an external KYC/AML/sanctions check.

**Body:**
```json
{
  "recipient_id": 5,
  "check_type": "kyc",
  "status": "passed",
  "risk_score": 15,
  "provider": "Jumio",
  "reference": "jmio-ref-abc123",
  "expires_at": "2027-06-01T00:00:00Z"
}
```
`check_type`: `kyc` | `sanctions` | `aml` | `risk_score`  
`status`: `pending` | `passed` | `failed` | `manual_review`

---

### GET /api/compliance/checks/:id

---

### GET /api/compliance/recipients/:id/status

Returns consolidated compliance view: latest check per type, blocked status, full history.

---

### POST /api/compliance/screen

Screen all linked recipients in a batch before submission.

**Body:** `{ "batch_id": 42 }`

**Response:**
```json
{
  "batch_id": 42,
  "total_screened": 25,
  "issues": [],
  "warnings": [{ "recipient_id": 3, "kyc_status": "pending" }],
  "clearance": "clear"
}
```

---

### GET /api/compliance/audit-trail

Paginated immutable audit log.

---

## Analytics

### GET /api/analytics/summary

Overall organization statistics.

### GET /api/analytics/volume

**Query params:** `period` (`7d` | `30d` | `90d` | `1y`), `currency`

### GET /api/analytics/by-currency

Asset distribution breakdown.

### GET /api/analytics/by-type

Batch type breakdown (payroll / aid / disbursement / contractor).

### GET /api/analytics/recipients

Recipient statistics including KYC breakdown and top recipients by volume.

### GET /api/analytics/anchor-usage

Anchor / cash-out statistics.

### GET /api/analytics/payroll-metrics

Payroll-specific metrics.

### GET /api/analytics/aid-metrics

Aid program disbursement statistics.

### GET /api/analytics/trustflow

TrustFlow allocation intake statistics.

---

## TrustFlow Integration

### GET /api/trustflow/allocations

List cached active TrustFlow funding allocations.

### POST /api/trustflow/allocations/sync

Force re-sync of allocations from TrustFlow API.

### POST /api/trustflow/link

Link this org to a TrustFlow org ID.

**Body:** `{ "trustflow_org_id": "tf-org-123" }`

### GET /api/trustflow/trust-score

Fetch trust score for this org from TrustFlow.

### POST /api/trustflow/allocations/:id/consume

Mark an allocation as consumed for a specific batch.

**Body:** `{ "amount": 5000, "batch_id": 42 }`

---

## Webhooks `public`

Verified by `X-Webhook-Signature` header (HMAC-SHA256).

### POST /api/webhooks/trustflow

Receive events from TrustFlow (`allocation.approved`, `stream.updated`, `org.suspended`).

### POST /api/webhooks/flowindexer

Receive events from FlowIndexer.

---

## Audit

### GET /api/audit

**Query params:** `page`, `limit`, `status`, `type`, `currency`

### GET /api/audit/events

View event outbox delivery log.

**Query params:** `page`, `limit`, `status`, `event_type`

### GET /api/audit/:batchId

Batch drilldown with payments and audit log entries.

### GET /api/audit/:batchId/export

Download CSV of all payments in a batch.

---

## Health `public`

### GET /api/health

```json
{
  "status": "ok",
  "version": "1.1.0",
  "checks": { "database": "ok" },
  "timestamp": "2026-06-08T10:00:00.000Z"
}
```

---

## Error Responses

All errors return:
```json
{ "error": "Human-readable error message" }
```

| Code | Meaning |
|------|---------|
| 400 | Bad request — invalid input |
| 401 | Unauthorized — missing or invalid JWT |
| 404 | Not found |
| 409 | Conflict — resource already in a conflicting state |
| 429 | Too Many Requests — rate limit exceeded |
| 500 | Internal server error |
| 503 | Service unavailable — DB unreachable |

Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
