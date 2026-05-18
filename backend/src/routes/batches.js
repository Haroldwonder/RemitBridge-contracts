const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { submitBatch, estimateFee } = require('../services/stellar');

// POST /api/batches — create + preview
router.post('/', auth, async (req, res) => {
  const { payments, currency } = req.body; // payments: [{recipient_id?, stellar_address, amount}]
  if (!payments?.length) return res.status(400).json({ error: 'payments required' });
  if (!['USDC', 'PYUSD'].includes(currency)) return res.status(400).json({ error: 'currency must be USDC or PYUSD' });

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);
  const fee_xlm = estimateFee(payments.length);

  const { rows } = await pool.query(
    `INSERT INTO batches (org_id, status, total_amount, currency, recipient_count)
     VALUES ($1,'pending',$2,$3,$4) RETURNING *`,
    [req.org.id, total, currency, payments.length]
  );
  const batch = rows[0];

  // Insert payment rows
  for (const p of payments) {
    await pool.query(
      `INSERT INTO payments (batch_id, recipient_id, stellar_address, amount, currency)
       VALUES ($1,$2,$3,$4,$5)`,
      [batch.id, p.recipient_id || null, p.stellar_address, p.amount, currency]
    );
  }

  res.status(201).json({ batch, fee_xlm, total });
});

// POST /api/batches/:id/submit — execute on Stellar
router.post('/:id/submit', auth, async (req, res) => {
  const { secret_key } = req.body;
  if (!secret_key) return res.status(400).json({ error: 'secret_key required' });

  const { rows: bRows } = await pool.query(
    'SELECT * FROM batches WHERE id=$1 AND org_id=$2', [req.params.id, req.org.id]
  );
  if (!bRows[0]) return res.status(404).json({ error: 'Batch not found' });
  if (bRows[0].status !== 'pending') return res.status(409).json({ error: 'Batch already submitted' });

  const { rows: pRows } = await pool.query(
    'SELECT * FROM payments WHERE batch_id=$1 ORDER BY id', [req.params.id]
  );

  await pool.query('UPDATE batches SET status=$1 WHERE id=$2', ['submitted', req.params.id]);

  // Submit async — respond immediately with batch id, client polls status
  res.json({ batch_id: bRows[0].id, message: 'Submission started' });

  // Execute in background
  (async () => {
    try {
      const results = await submitBatch(secret_key, pRows);
      let successCount = 0;
      for (const r of results) {
        const p = pRows[r.index];
        await pool.query(
          'UPDATE payments SET status=$1, tx_hash=$2, error_msg=$3 WHERE id=$4',
          [r.status, r.tx_hash, r.error || null, p.id]
        );
        if (r.status === 'success') successCount++;
      }
      const finalStatus = successCount === pRows.length ? 'complete' : successCount > 0 ? 'partial' : 'failed';
      await pool.query(
        'UPDATE batches SET status=$1, submitted_at=NOW() WHERE id=$2',
        [finalStatus, req.params.id]
      );
      // Audit log
      await pool.query(
        `INSERT INTO audit_logs (org_id, batch_id, action, details)
         VALUES ($1,$2,'batch_submitted',$3)`,
        [req.org.id, req.params.id, JSON.stringify({ successCount, total: pRows.length })]
      );
    } catch (e) {
      await pool.query('UPDATE batches SET status=$1 WHERE id=$2', ['failed', req.params.id]);
    }
  })();
});

// GET /api/batches — list all batches for org
router.get('/', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM batches WHERE org_id=$1 ORDER BY created_at DESC', [req.org.id]
  );
  res.json(rows);
});

// GET /api/batches/:id — batch detail with payments
router.get('/:id', auth, async (req, res) => {
  const { rows: bRows } = await pool.query(
    'SELECT * FROM batches WHERE id=$1 AND org_id=$2', [req.params.id, req.org.id]
  );
  if (!bRows[0]) return res.status(404).json({ error: 'Not found' });
  const { rows: pRows } = await pool.query(
    `SELECT p.*, r.name as recipient_name FROM payments p
     LEFT JOIN recipients r ON r.id = p.recipient_id
     WHERE p.batch_id=$1 ORDER BY p.id`,
    [req.params.id]
  );
  res.json({ batch: bRows[0], payments: pRows });
});

// POST /api/batches/:id/clawback — admin clawback (records in audit log; contract call simulated)
router.post('/:id/clawback', auth, async (req, res) => {
  const { payment_index } = req.body;
  const { rows: bRows } = await pool.query(
    'SELECT * FROM batches WHERE id=$1 AND org_id=$2', [req.params.id, req.org.id]
  );
  if (!bRows[0]) return res.status(404).json({ error: 'Batch not found' });

  const { rows: pRows } = await pool.query(
    'SELECT * FROM payments WHERE batch_id=$1 ORDER BY id', [req.params.id]
  );
  const payment = pRows[payment_index];
  if (!payment) return res.status(400).json({ error: 'Invalid payment index' });

  const ageMs = Date.now() - new Date(payment.created_at).getTime();
  if (ageMs > 48 * 3600 * 1000) return res.status(400).json({ error: 'Clawback window expired (48h)' });

  await pool.query(
    `INSERT INTO audit_logs (org_id, batch_id, payment_id, action, details)
     VALUES ($1,$2,$3,'clawback',$4)`,
    [req.org.id, req.params.id, payment.id, JSON.stringify({ payment_index, amount: payment.amount, currency: payment.currency })]
  );
  res.json({ message: 'Clawback recorded', payment_id: payment.id });
});

module.exports = router;
