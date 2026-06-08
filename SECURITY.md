# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x (current) | ✅ |
| < 1.0 | ❌ |

## Reporting a Vulnerability

**Do NOT file a public GitHub issue for security vulnerabilities.**

Please report security issues privately to: **security@opentrust.dev**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to acknowledge reports within **48 hours** and provide a status update within **7 days**.

## Security Model

### What RemitBridge Protects

- **Multi-tenant isolation** — All data access is scoped to `org_id` extracted from a verified JWT. No cross-org data leakage is possible through the API.
- **Secret key handling** — The Stellar signing secret is shown once at signup and never stored. It is passed by clients per-submission and is not logged.
- **Audit trail** — All mutations write to `audit_logs`. The trail is append-only.
- **Clawback window** — Disbursements can be clawed back within 48 hours, enforced in both the DB and the Soroban contract.

### What RemitBridge Does NOT Handle

- Key custody — we do not store or manage Stellar secret keys.
- End-to-end encryption of payments data at rest — use a DB-level encryption layer.
- Compliance legal advice — compliance records are a tool, not a legal guarantee.

### Known Security Limitations

1. **Secret key in request body** — The Stellar secret key is submitted per-batch. We recommend a future upgrade to backend signing via non-custodial Stellar signing services.
2. **In-process rate limiting** — The current rate limiter is in-memory and does not persist across instances. Use Redis for multi-instance deployments.
3. **Webhook signatures** — Incoming webhook signature verification is implemented as a placeholder. Enable by setting `TRUSTFLOW_WEBHOOK_SECRET` and `FLOWINDEXER_WEBHOOK_SECRET`.

## Dependency Security

We use `npm audit` in CI. Dependencies with known CVEs are patched within 30 days of disclosure.

## Responsible Disclosure

We follow coordinated disclosure. We will:
1. Acknowledge your report
2. Work with you to understand and reproduce the issue
3. Develop and test a fix
4. Release the fix
5. Credit you in the changelog (unless you prefer to remain anonymous)
