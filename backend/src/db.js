const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS orgs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  country TEXT NOT NULL,
  use_case TEXT NOT NULL CHECK (use_case IN ('ngo','employer','remittance')),
  stellar_public_key TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  trustflow_org_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipients (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  stellar_address TEXT,
  phone TEXT,
  country TEXT,
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','approved','rejected','flagged')),
  trust_score NUMERIC,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS batches (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'disbursement' CHECK (type IN ('disbursement','payroll','aid','contractor')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','awaiting_approval','submitted','partial','complete','failed','cancelled')),
  total_amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  recipient_count INTEGER NOT NULL,
  memo TEXT,
  trustflow_allocation_id TEXT,
  aid_program_id INTEGER,
  payroll_schedule_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  recipient_id INTEGER REFERENCES recipients(id),
  stellar_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed','clawed_back')),
  tx_hash TEXT,
  error_msg TEXT,
  anchor_status TEXT,
  anchor_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  batch_id INTEGER REFERENCES batches(id),
  payment_id INTEGER REFERENCES payments(id),
  actor_id INTEGER,
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payroll scheduling
CREATE TABLE IF NOT EXISTS payroll_schedules (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  cron_expr TEXT NOT NULL,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  require_approval BOOLEAN NOT NULL DEFAULT false,
  min_approvals INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval workflow for large or sensitive batches
CREATE TABLE IF NOT EXISTS batch_approvals (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  approver_id INTEGER,
  approver_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aid distribution programs
CREATE TABLE IF NOT EXISTS aid_programs (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  region TEXT,
  country TEXT,
  program_type TEXT NOT NULL DEFAULT 'cash' CHECK (program_type IN ('cash','voucher','emergency','recurring')),
  budget_total NUMERIC,
  budget_spent NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USDC',
  active BOOLEAN NOT NULL DEFAULT true,
  trustflow_stream_id TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beneficiary groups for aid programs
CREATE TABLE IF NOT EXISTS beneficiary_groups (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  aid_program_id INTEGER REFERENCES aid_programs(id),
  name TEXT NOT NULL,
  description TEXT,
  region TEXT,
  country TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beneficiary group membership
CREATE TABLE IF NOT EXISTS beneficiary_group_members (
  group_id INTEGER NOT NULL REFERENCES beneficiary_groups(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, recipient_id)
);

-- KYC / compliance records
CREATE TABLE IF NOT EXISTS compliance_records (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  recipient_id INTEGER REFERENCES recipients(id),
  check_type TEXT NOT NULL CHECK (check_type IN ('kyc','sanctions','aml','risk_score')),
  status TEXT NOT NULL CHECK (status IN ('pending','passed','failed','manual_review')),
  risk_score NUMERIC,
  provider TEXT,
  reference TEXT,
  details JSONB,
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Outbox for reliable event delivery to FlowIndexer
CREATE TABLE IF NOT EXISTS events_outbox (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_version TEXT NOT NULL DEFAULT '1.0',
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

-- Analytics aggregates (pre-computed, refreshed periodically)
CREATE TABLE IF NOT EXISTS analytics_daily (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  batch_type TEXT NOT NULL,
  currency TEXT NOT NULL,
  country TEXT,
  payment_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  unique_recipients INTEGER NOT NULL DEFAULT 0,
  UNIQUE (org_id, date, batch_type, currency, country)
);

-- TrustFlow cached allocations
CREATE TABLE IF NOT EXISTS trustflow_allocations (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  trustflow_allocation_id TEXT NOT NULL UNIQUE,
  trustflow_org_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_recipients_org_id ON recipients(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_batches_org_id ON batches(org_id);
CREATE INDEX IF NOT EXISTS idx_batches_org_status ON batches(org_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_batch_id ON payments(batch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_events_outbox_status ON events_outbox(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_compliance_records_recipient ON compliance_records(recipient_id);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_org_date ON analytics_daily(org_id, date);
`;

async function initDb() {
  await pool.query(SCHEMA);
}

module.exports = { pool, initDb };
