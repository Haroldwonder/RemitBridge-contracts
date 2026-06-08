# Contributing to RemitBridge

Thank you for your interest in contributing to RemitBridge! This guide will help you get started.

## Code of Conduct

Please read our [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## How to Contribute

### Reporting Bugs

1. Search [existing issues](https://github.com/opentrust-labs/remitbridge/issues) first.
2. Open a new issue using the **Bug Report** template.
3. Include: steps to reproduce, expected vs actual behavior, environment details.

### Requesting Features

1. Open a new issue using the **Feature Request** template.
2. Describe the use case and why existing functionality doesn't address it.
3. If the feature touches TrustFlow or FlowIndexer integration, link to relevant docs.

### Submitting Code

#### Setup

```bash
git clone https://github.com/opentrust-labs/remitbridge.git
cd remitbridge
cp .env.example .env
docker compose up postgres -d

cd backend && npm install
cd ../frontend && npm install
```

#### Development Workflow

1. **Fork** the repository.
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/issue-123-description
   ```
3. **Write code** following the style guide below.
4. **Write tests** for any new functionality.
5. **Run tests** and ensure all pass:
   ```bash
   cd backend && npm test
   ```
6. **Commit** with a descriptive message:
   ```
   feat(aid): add voucher distribution support
   fix(batches): prevent double-submission of pending batches
   docs(api): document /compliance/checks endpoint
   ```
7. **Open a Pull Request** against `main`.

#### Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<short-desc>` | `feat/scheduled-payroll` |
| Bug fix | `fix/<issue-or-desc>` | `fix/clawback-window` |
| Documentation | `docs/<desc>` | `docs/api-reference` |
| Test | `test/<desc>` | `test/compliance-coverage` |
| Refactor | `refactor/<desc>` | `refactor/event-publisher` |

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`  
**Scopes:** `api`, `db`, `events`, `trustflow`, `compliance`, `aid`, `payroll`, `frontend`, `contracts`

## Style Guide

### Backend (Node.js)

- No TypeScript — plain JavaScript ES2022
- `async/await` for all async operations
- No `console.log` in route handlers (use structured logging)
- All routes must validate input before touching the DB
- All mutations must write to `audit_logs`
- All mutations must emit events via `eventPublisher`
- Use `parsePagination()` for all list endpoints
- Foreign key queries must include `org_id` filter

### Tests

- All new routes need at least one happy-path and one error-path test
- Mock the DB (`pool.query`) and event publisher — no real DB in unit tests
- Use `jest.mock` at the top of each test file
- Test names should describe behavior, not implementation

### Frontend (React)

- Functional components only
- Tailwind CSS utility classes
- No inline styles
- API calls via the shared `api.js` client

### Smart Contracts (Rust/Soroban)

- Follow `soroban-sdk` patterns
- All public functions need a test
- No `panic!` in production paths — use proper error codes

## Pull Request Requirements

- [ ] All tests pass (`npm test`)
- [ ] New functionality has tests
- [ ] No new `console.log` statements in production code
- [ ] API changes are documented in `API.md`
- [ ] Breaking changes note in PR description
- [ ] PR title follows Conventional Commits format

## Areas Where We Need Help

See the [issue tracker](https://github.com/opentrust-labs/remitbridge/issues) and filter by:

- [`good first issue`](https://github.com/opentrust-labs/remitbridge/issues?q=label:good+first+issue) — Great for newcomers
- [`help wanted`](https://github.com/opentrust-labs/remitbridge/issues?q=label:help+wanted) — Intermediate contributions
- [`advanced`](https://github.com/opentrust-labs/remitbridge/issues?q=label:advanced) — Deep technical work

## Questions

- Open a [Discussion](https://github.com/opentrust-labs/remitbridge/discussions) for design questions
- Use issues only for bugs and feature requests
- Tag `@opentrust-labs/remitbridge` for urgent reviews
