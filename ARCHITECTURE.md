# RemitBridge Architecture

## Overview

RemitBridge is a three-tier web application built on a PostgreSQL + Node.js + React stack, with Stellar as the settlement layer and Soroban for on-chain compliance records.

## Directory Structure

```
remitbridge/
├── backend/
│   ├── src/
│   │   ├── index.js                    # Express app + server bootstrap
│   │   ├── db.js                       # PostgreSQL pool + schema DDL
│   │   ├── middleware/
│   │   │   ├── auth.js                 # JWT verification
│   │   │   ├── rateLimiter.js          # Sliding-window rate limiting
│   │   │   └── validate.js             # Input validation helpers
│   │   ├── routes/
│   │   │   ├── orgs.js                 # Org signup, login, profile
│   │   │   ├── recipients.js           # Recipient CRUD + CSV import
│   │   │   ├── batches.js              # Batch disbursements
│   │   │   ├── payroll.js              # Scheduled payroll + approvals
│   │   │   ├── aid.js                  # Aid programs + beneficiary groups
│   │   │   ├── compliance.js           # KYC / sanctions / audit trail
│   │   │   ├── analytics.js            # Reporting endpoints
│   │   │   ├── trustflow.js            # TrustFlow allocation management
│   │   │   ├── webhooks.js             # Inbound TrustFlow/FlowIndexer events
│   │   │   ├── audit.js                # Audit log + CSV export
│   │   │   └── health.js               # Health check
│   │   ├── services/
│   │   │   └── stellar.js              # Stellar Horizon integration
│   │   ├── integrations/
│   │   │   └── trustflow/
│   │   │       ├── TrustFlowProvider.js    # HTTP client for TrustFlow API
│   │   │       ├── TrustFlowAdapter.js     # Data normalization layer
│   │   │       ├── TrustScoreService.js    # Trust score fetching + caching
│   │   │       ├── FundingAllocationService.js  # Allocation sync + consumption
│   │   │       └── index.js                # Singleton exports
│   │   └── events/
│   │       ├── EventSchemas.js         # Event type constants + schema factories
│   │       ├── EventPublisher.js       # Outbox writer
│   │       ├── FlowIndexerPublisher.js # Background HTTP delivery worker
│   │       └── index.js                # Module exports
│   └── tests/
│       ├── stellar.test.js
│       ├── batches.test.js
│       ├── recipients.test.js
│       ├── payroll.test.js
│       ├── aid.test.js
│       ├── compliance.test.js
│       ├── analytics.test.js
│       ├── events.test.js
│       └── trustflow.test.js
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── api.js                      # Axios client with token injection
│       ├── context/AuthContext.jsx
│       ├── components/Layout.jsx
│       └── pages/
│           ├── Dashboard.jsx
│           ├── Recipients.jsx
│           ├── NewBatch.jsx
│           ├── BatchDetail.jsx
│           ├── AuditTrail.jsx
│           ├── Login.jsx
│           └── Signup.jsx
└── contracts/
    └── compliance/                     # Soroban smart contract (Rust)
        ├── Cargo.toml
        └── src/lib.rs
```

## Data Model

### Core Entities

```
orgs (1) ──────────────────────────────────────── (N) batches
  │                                                     │
  └── (N) recipients                             (N) payments
  │         │
  │         └── beneficiary_group_members
  │
  └── (N) aid_programs
  │         │
  │         └── beneficiary_groups
  │                   │
  │                   └── beneficiary_group_members
  │
  └── (N) payroll_schedules
  └── (N) compliance_records
  └── (N) trustflow_allocations
  └── (N) audit_logs
```

### Key Constraints

- `orgs` owns all data via `org_id` foreign keys — complete multi-tenant isolation
- `recipients` uses soft delete (`deleted_at`) to preserve payment history
- `batches.type` classifies disbursements: `disbursement`, `payroll`, `aid`, `contractor`
- `payments.status` flows: `pending → success | failed | clawed_back`
- `batches.status` flows: `pending → awaiting_approval → submitted → complete | partial | failed | cancelled`

## Key Design Decisions

### 1. Transactional Outbox for Events

Events are written to `events_outbox` atomically within the same DB transaction as the mutation that caused them. A background `FlowIndexerPublisher` polls and delivers with at-least-once semantics.

This avoids dual-write problems: if the Stellar call succeeds but FlowIndexer is unreachable, events queue up and retry — no events are lost.

### 2. TrustFlow Adapter Pattern

`TrustFlowAdapter` decouples RemitBridge from TrustFlow API shape changes. All TrustFlow-shaped objects are converted to RemitBridge domain types at the boundary. The `TrustFlowProvider` (HTTP client) and `TrustFlowAdapter` (normalizer) are injected into services, making them independently testable and replaceable.

### 3. Async Batch Submission

Stellar transaction submission can take 5–30 seconds. The batch submit endpoint:
1. Immediately returns `{ batch_id, message: "Submission started" }` to the client
2. Executes the Stellar calls in a detached async closure
3. Updates payment statuses as each chunk completes
4. Client polls `GET /batches/:id` for the final status

**Trade-off:** If the server crashes mid-execution, the batch stays in `submitted` status indefinitely. Production systems should replace this with a proper job queue (Bull, pg-boss, etc.).

### 4. Chunked Stellar Transactions

Stellar limits transactions to 100 operations each. `submitBatch` splits large recipient lists into chunks of 100 and submits sequential transactions, advancing the sequence number between chunks.

### 5. Rate Limiting Tiers

Three rate limiter configurations based on endpoint sensitivity:
- `authLimiter` — 10 req/min per IP (for signup/login)
- `apiLimiter` — 120 req/min per org
- `batchSubmitLimiter` — 5 req/min per org (Stellar ops are expensive)

### 6. Soft Delete for Recipients

Recipients use soft delete (`deleted_at`) rather than hard delete. This preserves payment history integrity — payments referencing deleted recipients still display correctly in audit exports.

## Security Architecture

| Layer | Control |
|-------|---------|
| Transport | HTTPS (enforced by reverse proxy) |
| Authentication | JWT (HS256, 7-day TTL) |
| Authorization | Org isolation — all queries filter by `org_id` from JWT |
| CORS | Allowlist of trusted origins |
| Rate Limiting | Per-IP and per-org sliding window |
| Input Validation | Type checking + Stellar address validation at boundary |
| Secrets | Secret key never stored — shown once at signup |
| Audit | All mutations write to `audit_logs` |

## Scalability Notes

- **DB Pool** — `max: 20` connections with timeouts; configurable for load
- **Horizontal Scaling** — Stateless API can scale behind a load balancer; rate limiter needs Redis upgrade
- **Read Replicas** — Analytics endpoints can route to read replica
- **Event Delivery** — Outbox worker runs per-instance; idempotent delivery handles duplicates
- **Caching** — Trust score responses cached 5 minutes in-process; Redis is the right upgrade
