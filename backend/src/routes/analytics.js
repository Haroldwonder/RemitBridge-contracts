const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

// GET /api/analytics/summary — overall org summary
router.get('/summary', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       COUNT(DISTINCT b.id) FILTER (WHERE b.status IN ('complete','partial')) as completed_batches,
       COUNT(DISTINCT b.id) as total_batches,
       COALESCE(SUM(b.total_amount) FILTER (WHERE b.status IN ('complete','partial')), 0) as total_disbursed,
       COUNT(DISTINCT p.id) FILTER (WHERE p.status='success') as successful_payments,
       COUNT(DISTINCT p.id) FILTER (WHERE p.status='failed') as failed_payments,
       COUNT(DISTINCT b.recipient_count) as total_recipients_reached,
       MIN(b.created_at) as first_batch_at,
       MAX(b.created_at) as last_batch_at
     FROM batches b
     LEFT JOIN payments p ON p.batch_id=b.id
     WHERE b.org_id=$1`,
    [req.org.id]
  );
  res.json(rows[0]);
});

// GET /api/analytics/volume — payment volume over time
router.get('/volume', auth, async (req, res) => {
  const { period = '30d', currency } = req.query;
  const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : 30;

  let query = `
    SELECT
      DATE_TRUNC('day', b.created_at) as date,
      b.currency,
      COUNT(DISTINCT b.id) as batch_count,
      SUM(b.total_amount) as total_amount,
      SUM(b.recipient_count) as recipient_count
    FROM batches b
    WHERE b.org_id=$1
      AND b.status IN ('complete','partial')
      AND b.created_at >= NOW() - INTERVAL '${days} days'`;
  const params = [req.org.id];
  if (currency) { params.push(currency); query += ` AND b.currency=$${params.length}`; }
  query += ` GROUP BY DATE_TRUNC('day', b.created_at), b.currency ORDER BY date ASC`;

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// GET /api/analytics/by-currency — asset distribution
router.get('/by-currency', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       b.currency,
       COUNT(DISTINCT b.id) as batch_count,
       SUM(b.total_amount) as total_amount,
       COUNT(p.id) FILTER (WHERE p.status='success') as payment_count
     FROM batches b
     LEFT JOIN payments p ON p.batch_id=b.id
     WHERE b.org_id=$1 AND b.status IN ('complete','partial')
     GROUP BY b.currency`,
    [req.org.id]
  );
  res.json(rows);
});

// GET /api/analytics/by-type — batch type breakdown (payroll vs aid vs remittance)
router.get('/by-type', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       b.type,
       COUNT(DISTINCT b.id) as batch_count,
       COALESCE(SUM(b.total_amount) FILTER (WHERE b.status IN ('complete','partial')), 0) as total_disbursed,
       SUM(b.recipient_count) as total_recipients
     FROM batches b
     WHERE b.org_id=$1
     GROUP BY b.type`,
    [req.org.id]
  );
  res.json(rows);
});

// GET /api/analytics/recipients — recipient statistics
router.get('/recipients', auth, async (req, res) => {
  const [countRes, kycRes, topRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE kyc_status='approved') as kyc_approved,
              COUNT(*) FILTER (WHERE kyc_status='rejected') as kyc_rejected,
              COUNT(*) FILTER (WHERE kyc_status='pending') as kyc_pending
       FROM recipients WHERE org_id=$1 AND deleted_at IS NULL`,
      [req.org.id]
    ),
    pool.query(
      `SELECT country, COUNT(*) as count FROM recipients
       WHERE org_id=$1 AND deleted_at IS NULL AND country IS NOT NULL
       GROUP BY country ORDER BY count DESC LIMIT 10`,
      [req.org.id]
    ),
    pool.query(
      `SELECT r.name, r.stellar_address, r.country,
              COUNT(p.id) FILTER (WHERE p.status='success') as payment_count,
              SUM(p.amount) FILTER (WHERE p.status='success') as total_received
       FROM recipients r
       LEFT JOIN payments p ON p.recipient_id=r.id
       WHERE r.org_id=$1 AND r.deleted_at IS NULL
       GROUP BY r.id ORDER BY total_received DESC NULLS LAST LIMIT 10`,
      [req.org.id]
    ),
  ]);
  res.json({
    counts: countRes.rows[0],
    by_country: kycRes.rows,
    top_recipients: topRes.rows,
  });
});

// GET /api/analytics/anchor-usage — cashout / anchor stats
router.get('/anchor-usage', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       anchor_status,
       COUNT(*) as count,
       SUM(amount) as total_amount,
       currency
     FROM payments
     WHERE batch_id IN (SELECT id FROM batches WHERE org_id=$1)
       AND anchor_status IS NOT NULL
     GROUP BY anchor_status, currency`,
    [req.org.id]
  );
  res.json(rows);
});

// GET /api/analytics/trustflow — TrustFlow funding intake stats
router.get('/trustflow', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       status,
       currency,
       COUNT(*) as allocation_count,
       SUM(amount) as total_amount
     FROM trustflow_allocations
     WHERE org_id=$1
     GROUP BY status, currency`,
    [req.org.id]
  );
  res.json(rows);
});

// GET /api/analytics/payroll-metrics — payroll-specific stats
router.get('/payroll-metrics', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       b.currency,
       COUNT(DISTINCT b.id) as payroll_runs,
       SUM(b.total_amount) as total_payroll,
       AVG(b.total_amount) as avg_payroll_size,
       SUM(b.recipient_count) as total_payees,
       COUNT(DISTINCT b.payroll_schedule_id) FILTER (WHERE b.payroll_schedule_id IS NOT NULL) as scheduled_runs
     FROM batches b
     WHERE b.org_id=$1 AND b.type IN ('payroll','contractor')
       AND b.status IN ('complete','partial')
     GROUP BY b.currency`,
    [req.org.id]
  );
  res.json(rows);
});

// GET /api/analytics/aid-metrics — aid disbursement stats
router.get('/aid-metrics', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       ap.name as program_name,
       ap.program_type,
       ap.country,
       ap.budget_total,
       ap.budget_spent,
       ap.currency,
       COUNT(DISTINCT b.id) as disbursement_count,
       SUM(b.recipient_count) as total_beneficiaries
     FROM aid_programs ap
     LEFT JOIN batches b ON b.aid_program_id=ap.id AND b.status IN ('complete','partial')
     WHERE ap.org_id=$1
     GROUP BY ap.id ORDER BY ap.created_at DESC`,
    [req.org.id]
  );
  res.json(rows);
});

module.exports = router;
