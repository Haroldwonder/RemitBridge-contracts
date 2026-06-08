const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { parsePagination } = require('../middleware/validate');
const { eventPublisher } = require('../events/EventPublisher');
const { Schemas } = require('../events/EventSchemas');

/**
 * Compliance layer — modular and pluggable.
 * Provider integrations (Chainalysis, Elliptic, Jumio, etc.) plug in via
 * the ComplianceService. The routes here record results and emit events.
 */

// GET /api/compliance/checks — list compliance checks for the org
router.get('/checks', auth, async (req, res) => {
  const { limit, offset } = parsePagination(req);
  const { check_type, status, recipient_id } = req.query;
  let query = `SELECT c.*, r.name as recipient_name
               FROM compliance_records c
               LEFT JOIN recipients r ON r.id=c.recipient_id
               WHERE c.org_id=$1`;
  const params = [req.org.id];
  if (check_type) { params.push(check_type); query += ` AND c.check_type=$${params.length}`; }
  if (status) { params.push(status); query += ` AND c.status=$${params.length}`; }
  if (recipient_id) { params.push(recipient_id); query += ` AND c.recipient_id=$${params.length}`; }
  query += ` ORDER BY c.checked_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// POST /api/compliance/checks — create / record a compliance check result
router.post('/checks', auth, async (req, res) => {
  const { recipient_id, check_type, status, risk_score, provider, reference, details, expires_at } = req.body;
  if (!check_type || !status)
    return res.status(400).json({ error: 'check_type and status required' });

  const validTypes = ['kyc', 'sanctions', 'aml', 'risk_score'];
  const validStatuses = ['pending', 'passed', 'failed', 'manual_review'];
  if (!validTypes.includes(check_type)) return res.status(400).json({ error: `check_type must be one of: ${validTypes.join(', ')}` });
  if (!validStatuses.includes(status)) return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });

  if (recipient_id) {
    const { rows: rRows } = await pool.query(
      'SELECT id FROM recipients WHERE id=$1 AND org_id=$2',
      [recipient_id, req.org.id]
    );
    if (!rRows[0]) return res.status(404).json({ error: 'Recipient not found' });
  }

  const { rows } = await pool.query(
    `INSERT INTO compliance_records
       (org_id, recipient_id, check_type, status, risk_score, provider, reference, details, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.org.id, recipient_id || null, check_type, status,
     risk_score || null, provider || null, reference || null,
     details ? JSON.stringify(details) : null, expires_at || null]
  );
  const record = rows[0];

  // Update recipient KYC status if this is a KYC check
  if (check_type === 'kyc' && recipient_id) {
    const kycMap = { passed: 'approved', failed: 'rejected', manual_review: 'flagged', pending: 'pending' };
    await pool.query(
      'UPDATE recipients SET kyc_status=$1 WHERE id=$2',
      [kycMap[status] || 'pending', recipient_id]
    );
  }

  await eventPublisher.publish(Schemas.complianceCheckCompleted(record, req.org.id));

  if (status === 'failed' && check_type === 'sanctions') {
    await eventPublisher.publish({
      event_type: 'remitbridge.compliance.sanctions_match',
      event_version: '1.0',
      source: 'remitbridge',
      timestamp: new Date().toISOString(),
      payload: { compliance_record_id: record.id, org_id: req.org.id, recipient_id },
    });
  }

  res.status(201).json(record);
});

// GET /api/compliance/checks/:id
router.get('/checks/:id', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM compliance_records WHERE id=$1 AND org_id=$2',
    [req.params.id, req.org.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// GET /api/compliance/recipients/:id/status — consolidated compliance view for a recipient
router.get('/recipients/:id/status', auth, async (req, res) => {
  const { rows: rRows } = await pool.query(
    'SELECT id, name, kyc_status, trust_score FROM recipients WHERE id=$1 AND org_id=$2',
    [req.params.id, req.org.id]
  );
  if (!rRows[0]) return res.status(404).json({ error: 'Recipient not found' });

  const { rows: checks } = await pool.query(
    `SELECT check_type, status, risk_score, checked_at, expires_at
     FROM compliance_records
     WHERE recipient_id=$1
     ORDER BY checked_at DESC`,
    [req.params.id]
  );

  const latest = {};
  for (const c of checks) {
    if (!latest[c.check_type]) latest[c.check_type] = c;
  }

  const blocked = Object.values(latest).some(c => c.status === 'failed');

  res.json({
    recipient: rRows[0],
    compliance: {
      blocked,
      checks: latest,
      history: checks,
    },
  });
});

// POST /api/compliance/screen — bulk screen a batch's recipients before submission
router.post('/screen', auth, async (req, res) => {
  const { batch_id } = req.body;
  if (!batch_id) return res.status(400).json({ error: 'batch_id required' });

  const { rows: pRows } = await pool.query(
    `SELECT p.recipient_id, r.kyc_status, r.trust_score,
            EXISTS (
              SELECT 1 FROM compliance_records c
              WHERE c.recipient_id=r.id AND c.check_type='sanctions' AND c.status='failed'
            ) as sanctions_match
     FROM payments p
     JOIN recipients r ON r.id=p.recipient_id
     WHERE p.batch_id=$1 AND p.recipient_id IS NOT NULL`,
    [batch_id]
  );

  const issues = pRows.filter(p => p.sanctions_match || p.kyc_status === 'rejected');
  const warnings = pRows.filter(p => p.kyc_status === 'pending' || p.kyc_status === 'flagged');

  res.json({
    batch_id,
    total_screened: pRows.length,
    issues,
    warnings,
    clearance: issues.length === 0 ? 'clear' : 'blocked',
  });
});

// GET /api/compliance/audit-trail — paginated immutable audit log
router.get('/audit-trail', auth, async (req, res) => {
  const { limit, offset } = parsePagination(req);
  const { rows } = await pool.query(
    `SELECT * FROM audit_logs WHERE org_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [req.org.id, limit, offset]
  );
  res.json(rows);
});

module.exports = router;
