# RemitBridge Contracts

**Soroban smart contracts for cross-border payroll and aid disbursement on Stellar.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OpenTrust Ecosystem](https://img.shields.io/badge/OpenTrust-Ecosystem-purple)](https://opentrust.dev)
[![Stellar](https://img.shields.io/badge/Stellar-Testnet-brightgreen)](https://stellar.org)

---

## Contracts

| Contract | Path | Description |
|---|---|---|
| **Compliance** | `contracts/compliance` | On-chain disbursement audit log with 48-hour clawback window |
| **Payroll** | `contracts/payroll` | Recurring payroll scheduling — tracks next payout timestamps |
| **Multisig** | `contracts/multisig` | N-of-M approval gate for large disbursement proposals |

---

## Prerequisites

- [Rust](https://rustup.rs/) with `wasm32-unknown-unknown` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/stellar-cli) (`stellar`)

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli --features opt
```

---

## Build

```bash
# build all contracts
cargo build --target wasm32-unknown-unknown --release

# or build a single contract
cargo build -p remitbridge-compliance --target wasm32-unknown-unknown --release
```

Compiled `.wasm` files are written to `target/wasm32-unknown-unknown/release/`.

---

## Test

```bash
cargo test
```

---

## Deploy (Stellar Testnet)

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/remitbridge_compliance.wasm \
  --source <YOUR_SECRET_KEY> \
  --network testnet
```

Repeat for `remitbridge_payroll.wasm` and `remitbridge_multisig.wasm`.

---

## Contract Interfaces

### Compliance

| Function | Description |
|---|---|
| `init(admin)` | Set the admin address (once) |
| `log_disbursement(org_id, recipient, amount, currency)` | Record a disbursement; returns index |
| `clawback(caller, index)` | Reverse a disbursement within 48 hours (admin only) |
| `get_record(index)` | Read a disbursement record |
| `record_count()` | Total records stored |

### Payroll

| Function | Description |
|---|---|
| `init(admin)` | Set the admin address (once) |
| `schedule(caller, org_id, recipient, amount, currency, interval_secs)` | Create a recurring entry |
| `cancel(caller, index)` | Deactivate a payroll entry |
| `mark_paid(caller, index)` | Advance the next_payout timestamp after settlement |
| `get_entry(index)` / `entry_count()` | Read schedule state |

### Multisig

| Function | Description |
|---|---|
| `init(signers, threshold)` | Configure signer set and approval threshold |
| `propose(proposer, description, amount, recipient)` | Submit a disbursement proposal |
| `vote(signer, proposal_id, approve)` | Approve or reject a proposal |
| `execute(signer, proposal_id)` | Mark an approved proposal as executed |
| `get_proposal(id)` / `proposal_count()` | Read proposal state |

---

## Ecosystem

RemitBridge contracts are consumed by:

- **[RemitBridge API](https://github.com/richardiyamura/remitbridge-api)** — Node.js backend that calls these contracts and integrates with TrustFlow / FlowIndexer
- **TrustFlow** — Trust-score gated funding allocations enforced at the multisig layer
- **FlowIndexer** — Off-chain indexer that reads contract events for analytics

---

## License

MIT
