const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { parsePagination } = require('../middleware/validate');

// GET /api/audit — paginated batch summary
router.get('/', auth, async (req, res) => {
  const { limit, offset } = parsePagination(req);
  const { status, type, currency } = req.query;

  let query = `
    SELECT b.id, b.created_at, b.submitted_at, b.status, b.type, b.total_amount, b.currency,
           b.recipient_count,
           COUNT(p.id) FILTER (WHERE p.status='success') as success_count,
           COUNT(p.id) FILTER (WHERE p.status='failed') as failed_count
    FROM batches b
    LEFT JOIN payments p ON p.batch_id = b.id
    WHERE b.org_id=$1`;
  const params = [req.org.id];
  if (status) { params.push(status); query += ` AND b.status=$${params.length}`; }
  if (type) { params.push(type); query += ` AND b.type=$${params.length}`; }
  if (currency) { params.push(currency); query += ` AND b.currency=$${params.length}`; }
  query += ` GROUP BY b.id ORDER BY b.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// GET /api/audit/events — event outbox log
router.get('/events', auth, async (req, res) => {
  const { limit, offset } = parsePagination(req);
  const { status, event_type } = req.query;
  let query = `SELECT id, event_type, event_version, status, attempts, created_at, delivered_at, last_error
               FROM events_outbox`;
  const params = [];
  const conditions = [];
  if (status) { params.push(status); conditions.push(`status=$${params.length}`); }
  if (event_type) { params.push(event_type); conditions.push(`event_type=$${params.length}`); }
  if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// GET /api/audit/:batchId — per-batch drilldown
router.get('/:batchId', auth, async (req, res) => {
  const { rows: bRows } = await pool.query(
    'SELECT * FROM batches WHERE id=$1 AND org_id=$2', [req.params.batchId, req.org.id]
  );
  if (!bRows[0]) return res.status(404).json({ error: 'Not found' });
  const { rows: pRows } = await pool.query(
    `SELECT p.*, r.name as recipient_name, r.email as recipient_email
     FROM payments p LEFT JOIN recipients r ON r.id=p.recipient_id
     WHERE p.batch_id=$1 ORDER BY p.id`,
    [req.params.batchId]
  );
  const { rows: logRows } = await pool.query(
    'SELECT * FROM audit_logs WHERE batch_id=$1 ORDER BY created_at ASC',
    [req.params.batchId]
  );
  res.json({ batch: bRows[0], payments: pRows, audit_log: logRows });
});

// GET /api/audit/:batchId/export — CSV download
router.get('/:batchId/export', auth, async (req, res) => {
  const { rows: bRows } = await pool.query(
    'SELECT * FROM batches WHERE id=$1 AND org_id=$2', [req.params.batchId, req.org.id]
  );
  if (!bRows[0]) return res.status(404).json({ error: 'Not found' });

  const { rows } = await pool.query(
    `SELECT p.id, r.name as recipient_name, p.stellar_address, p.amount, p.currency,
            p.status, p.tx_hash, p.error_msg, p.anchor_status, p.created_at
     FROM payments p LEFT JOIN recipients r ON r.id=p.recipient_id
     WHERE p.batch_id=$1 ORDER BY p.id`,
    [req.params.batchId]
  );

  const header = 'id,recipient_name,stellar_address,amount,currency,status,tx_hash,error_msg,anchor_status,created_at\n';
  const csv = header + rows.map(r =>
    [r.id, r.recipient_name || '', r.stellar_address, r.amount, r.currency,
     r.status, r.tx_hash || '', r.error_msg || '', r.anchor_status || '', r.created_at]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="batch-${req.params.batchId}.csv"`);
  res.send(csv);
});

module.exports = router;
