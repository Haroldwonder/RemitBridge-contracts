const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

// GET /api/audit — all batches summary
router.get('/', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.id, b.created_at, b.submitted_at, b.status, b.total_amount, b.currency,
            b.recipient_count,
            COUNT(p.id) FILTER (WHERE p.status='success') as success_count,
            COUNT(p.id) FILTER (WHERE p.status='failed') as failed_count
     FROM batches b
     LEFT JOIN payments p ON p.batch_id = b.id
     WHERE b.org_id=$1
     GROUP BY b.id ORDER BY b.created_at DESC`,
    [req.org.id]
  );
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
  res.json({ batch: bRows[0], payments: pRows });
});

// GET /api/audit/:batchId/export — CSV download
router.get('/:batchId/export', auth, async (req, res) => {
  const { rows: bRows } = await pool.query(
    'SELECT * FROM batches WHERE id=$1 AND org_id=$2', [req.params.batchId, req.org.id]
  );
  if (!bRows[0]) return res.status(404).json({ error: 'Not found' });
  const { rows } = await pool.query(
    `SELECT p.id, r.name as recipient_name, p.stellar_address, p.amount, p.currency,
            p.status, p.tx_hash, p.error_msg, p.created_at
     FROM payments p LEFT JOIN recipients r ON r.id=p.recipient_id
     WHERE p.batch_id=$1 ORDER BY p.id`,
    [req.params.batchId]
  );

  const header = 'id,recipient_name,stellar_address,amount,currency,status,tx_hash,error_msg,created_at\n';
  const csv = header + rows.map(r =>
    [r.id, r.recipient_name || '', r.stellar_address, r.amount, r.currency,
     r.status, r.tx_hash || '', r.error_msg || '', r.created_at].map(v => `"${v}"`).join(',')
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="batch-${req.params.batchId}.csv"`);
  res.send(csv);
});

module.exports = router;
