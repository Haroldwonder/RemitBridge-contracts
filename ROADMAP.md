# RemitBridge Roadmap

This document outlines the planned development trajectory for RemitBridge.

## Current Status: v1.1 — Ecosystem Integration

Core payment infrastructure is complete. Q2 2026 focus is ecosystem integration (TrustFlow, FlowIndexer) and feature depth (payroll, aid, compliance).

---

## Q3 2026 — Production Hardening

### Infrastructure
- [ ] Redis-backed rate limiting for horizontal scaling
- [ ] Job queue for Stellar batch submission (Bull/pg-boss) — eliminate detached async
- [ ] DB migrations with proper versioning (replace raw DDL on startup)
- [ ] Structured logging (Pino or Winston)
- [ ] Distributed tracing (OpenTelemetry)

### Security
- [ ] Webhook signature verification (HMAC-SHA256) for TrustFlow and FlowIndexer
- [ ] Move secret key signing to backend (non-custodial signing via Stellar Turrets or delegated signing)
- [ ] API key rotation support
- [ ] Audit log immutability guarantee (append-only enforced at DB level)

### Stellar
- [ ] SEP-24 live Anchor integration (replace FX simulation)
- [ ] Mainnet configuration and deployment guide
- [ ] Transaction status streaming via Stellar event stream

---

## Q4 2026 — OpenTrust SDK & Multi-Currency

### OpenTrust SDK
- [ ] `@opentrust/remitbridge-client` npm package
- [ ] Consistent SDK interface matching TrustFlow and FlowIndexer clients
- [ ] Type definitions and JSDoc

### Multi-Currency
- [ ] EURC (Euro stablecoin on Stellar) support
- [ ] XML / XRPL bridging exploration
- [ ] Dynamic FX rate oracle (Stellar DEX or Redstone)

### Payroll Engine
- [ ] Auto-execution of scheduled payrolls (cron runner)
- [ ] Email/Slack notifications for payroll completion
- [ ] Payroll approval mobile push notifications
- [ ] Payroll history and projections

---

## 2027 — Scale & Self-Service

### Beneficiary Self-Service
- [ ] Mobile SDK for recipients to manage their own Stellar wallets
- [ ] USSD interface for feature-phone recipients
- [ ] Beneficiary portal (self-service cash-out, history)

### Smart Contracts
- [ ] Wire Soroban compliance contract to backend batch flow
- [ ] On-chain disbursement proofs
- [ ] Soroban streaming payment contract

### Enterprise
- [ ] Multi-org workspaces
- [ ] Role-based access control (RBAC)
- [ ] SSO / SAML integration
- [ ] SLA-backed support tier

### Analytics
- [ ] Real-time dashboard with WebSocket push
- [ ] Custom report builder
- [ ] FlowIndexer-powered cross-ecosystem reports

---

## Backlog (Unscheduled)

- [ ] Fiat on-ramp for funding (MoonPay, Stripe)
- [ ] Programmable payroll rules (e.g. "hold 10% in escrow for 30 days")
- [ ] Cross-border tax withholding calculation
- [ ] Beneficiary credit scoring (TrustFlow reputation)
- [ ] Emergency disbursement templates
- [ ] Conflict-zone payment corridors (USAID, UN compatible)

---

## How to Influence the Roadmap

Open a [GitHub Discussion](https://github.com/opentrust-labs/remitbridge/discussions) with your use case. High-demand items move up.
