# RemitBridge Architecture Audit Report

**Date:** 2026-06-08  
**Auditor:** Staff Engineering / OpenTrust Labs  
**Scope:** Full codebase review — backend, frontend, smart contracts, infrastructure

---

## Executive Summary

RemitBridge is a functional MVP with a clean Stellar integration for batch disbursements. The core payment flow works well. However, the project has significant gaps in ecosystem integration, scalability, compliance infrastructure, test coverage, and documentation that must be addressed before it can serve as a production-grade OpenTrust ecosystem component.

---

## 1. Architecture Overview (Current State)

```
Frontend (React/Vite/Tailwind)
    │
    ▼ HTTP REST (axios)
Backend (Node.js/Express)
    │
    ├─▶ PostgreSQL (pg pool — no connection limits configured)
    └─▶ Stellar Horizon (testnet, hardcoded)
         │
         └─▶ Soroban Compliance Contract (not wired to backend)
```

### What Works Well

- Clean batch payment flow with chunked Stellar transactions (100 ops/tx limit respected)
- Proper JWT auth with org isolation
- CSV import for bulk recipient upload
- Clawback window enforcement (48h) mirrored in both DB and smart contract
- Fee estimation before submission
- Async batch submission with polling
- Good test coverage for the Stellar service layer

---

## 2. Technical Debt

### 2.1 Security Issues

| Severity | Issue | Location |
|----------|-------|----------|
| **HIGH** | Stellar secret key transmitted in request body (`{ secret_key }`) | `routes/batches.js:37` |
| **HIGH** | CORS is `*` — accepts requests from any origin | `index.js:8` |
| **HIGH** | No rate limiting on any endpoint | Global |
| **MEDIUM** | JWT secret falls back silently to `undefined` if env var missing | `middleware/auth.js:7` |
| **MEDIUM** | CSV upload has no MIME type validation — only size check | `routes/recipients.js:8` |
| **MEDIUM** | Soroban contract uses panic for auth failures — should use proper error codes | `contracts/compliance/src/lib.rs:68` |
| **LOW** | `console.error(err)` in global handler leaks stack traces to logs | `index.js:16` |

### 2.2 Data Model Issues

| Issue | Impact |
|-------|--------|
| No pagination on list endpoints | Will fail at scale (1000+ batches) |
| `orgs` table has no `email` field | Cannot notify orgs of events |
| `payments` table lacks `anchor_status` and `anchor_ref` fields | Anchor SEP-24 cashout not trackable |
| `batches` table has no `type` field | Cannot distinguish payroll vs aid vs remittance |
| No `payroll_schedules` table | Scheduled/recurring payroll impossible |
| No `compliance_records` table | KYC status not persisted |
| No `events_outbox` table | Event delivery not reliable |
| Audit log `details` is untyped JSONB | No schema enforcement on audit records |
| Missing indexes on `org_id` foreign keys | Query plans degrade at scale |

### 2.3 Missing APIs

| Missing | Description |
|---------|-------------|
| `GET /api/health` | Health check for load balancers |
| `GET /api/analytics/*` | Volume, country distribution, asset breakdown |
| `POST /api/payroll/schedules` | Recurring payroll |
| `POST /api/aid/programs` | NGO program management |
| `GET /api/compliance/checks` | KYC/sanctions status |
| `POST /api/webhooks/trustflow` | Receive TrustFlow funding events |
| `GET /api/batches` pagination | `?page=&limit=` |
| `GET /api/recipients/search` | Filter by name/address |

### 2.4 Missing Features

- Scheduled and recurring payroll
- Multi-signature approvals for large disbursements
- Department/contractor payroll segmentation
- NGO program management and beneficiary groups
- Voucher distribution and emergency campaigns
- KYC/sanctions screening integration
- Anchor SEP-24 live integration (currently simulated in frontend)
- TrustFlow funding allocation consumption
- FlowIndexer event publishing
- Webhook receiver for ecosystem events
- Pagination and cursor-based listing
- Soft-delete for recipients (hard delete loses history)

### 2.5 Scalability Concerns

| Concern | Impact |
|---------|--------|
| No DB connection pool limits | Thundering herd can exhaust Postgres connections |
| Batch submission fires Stellar calls synchronously in a detached async closure | Cannot retry or monitor; job queue (Bull/pg-boss) needed for production |
| `initDb()` runs raw DDL on every start | Lacks proper migration tracking; schema drift possible |
| No caching layer | `GET /api/recipients` re-queries DB on every API call |
| All Horizon calls go to testnet — hardcoded | Cannot switch to mainnet without code changes |
| No request timeout on Stellar operations | Long-running Horizon calls block the event loop |

### 2.6 Test Coverage Gaps

| Area | Current Coverage | Gap |
|------|-----------------|-----|
| Stellar service | Good (4 tests) | Missing: mainnet flag, timeout, fee edge cases |
| Batch routes | Partial (4 tests) | Missing: clawback, GET routes, CSV |
| Recipient routes | None | All paths untested |
| Org routes | None | Signup, login, me untested |
| Audit routes | None | All paths untested |
| Analytics | N/A | Not implemented |
| TrustFlow integration | N/A | Not implemented |
| Events | N/A | Not implemented |

### 2.7 Documentation Gaps

- README is a single sentence
- No API documentation
- No architecture diagram
- No deployment guide
- No CONTRIBUTING.md
- No SECURITY.md
- No CODE_OF_CONDUCT.md
- No ROADMAP.md
- No GitHub issue templates
- Smart contract has no NatSpec or usage guide

### 2.8 UX Issues

| Issue | Location |
|-------|----------|
| Secret key entered in a form field — never cleared from browser memory on back navigation | `NewBatch.jsx:57` |
| Dashboard shows hardcoded `$` prefix regardless of currency (could show PYUSD) | `Dashboard.jsx:27` |
| No loading states on Recipients page | `Recipients.jsx` |
| Anchor cashout modal shows hardcoded FX rates | `AnchorModal.jsx:2` |
| No error boundary — any unhandled JS error crashes the entire app | `App.jsx` |
| Batch detail doesn't auto-refresh if navigated to directly | `BatchDetail.jsx` |

---

## 3. Ecosystem Integration Gaps

### TrustFlow Integration

| Missing Component | Description |
|------------------|-------------|
| `TrustFlowProvider` | HTTP client for TrustFlow API |
| `TrustFlowAdapter` | Normalize TrustFlow data structures |
| `FundingAllocationService` | Consume funding allocations as batch inputs |
| `TrustScoreService` | Gate payroll on recipient trust score |
| Webhook receiver | Accept funding approval events from TrustFlow |

### FlowIndexer Integration

| Missing Component | Description |
|------------------|-------------|
| Event outbox | Reliable at-least-once delivery table |
| Event schemas | Typed event contracts with versioning |
| `FlowIndexerPublisher` | HTTP/webhook publisher to FlowIndexer |
| Event hooks in routes | Wire events to every mutation endpoint |

---

## 4. Smart Contract Issues

| Issue | Description |
|-------|-------------|
| Contract not called from backend | `log_disbursement` and `clawback` are unused |
| Storage grows unbounded | `Vec<DisbursementRecord>` in instance storage hits Soroban limits |
| No `symbol_short!` for RECORDS_KEY | String constants bypass Soroban symbol optimization |
| No `KYCRecord` contract type | Compliance contract only tracks disbursements |
| `CLAWBACK_WINDOW_SECS` is a constant | Should be admin-configurable |

---

## 5. Infrastructure Issues

| Issue | Description |
|-------|-------------|
| `docker-compose.yml` mounts `src/` as volume | Works for dev, but build artifacts are not isolated |
| No `.env` validation on startup | Missing vars fail silently |
| No health endpoint for container orchestration | `depends_on` uses TCP check only |
| Friendbot call during signup | Testnet-only; breaks in staging/prod |
| No log aggregation config | `console.log/error` only |

---

## 6. Recommended Changes (Priority Order)

### P0 — Security (Do Before Launch)
1. Move secret key signing to backend key vault or delegated signing; never accept raw secret key over HTTP
2. Restrict CORS to known origins
3. Add rate limiting to all endpoints
4. Validate JWT_SECRET present on startup

### P1 — Ecosystem Integration
5. Implement TrustFlow integration layer (provider + adapter + services)
6. Implement FlowIndexer event system (outbox + publisher)
7. Wire events to all mutation endpoints

### P2 — Missing Features
8. Scheduled and recurring payroll with cron support
9. Multi-signature approval workflow
10. Aid program / beneficiary group management
11. Compliance layer (KYC records, risk scores, sanctions placeholder)

### P3 — Quality
12. Add pagination to all list endpoints
13. Add proper DB migrations (not raw DDL on start)
14. Replace detached async batch with job queue
15. Add 80%+ test coverage

### P4 — Documentation
16. Replace README with professional open-source README
17. Add CONTRIBUTING, ARCHITECTURE, ROADMAP, SECURITY, CODE_OF_CONDUCT, API docs
18. Create GitHub issue templates and backlog
