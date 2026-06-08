const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { parsePagination } = require('../middleware/validate');
const { submitBatch, estimateFee } = require('../services/stellar');
const { eventPublisher } = require('../events/EventPublisher');
const { Schemas } = require('../events/EventSchemas');
const { batchSubmitLimiter } = require('../middleware/rateLimiter');

const VALID_CURRENCIES = ['USDC', 'PYUSD'];

// POST /api/batches — create + preview
router.post('/', auth, async (req, res) => {
  const { payments, currency, type, memo, aid_program_id, payroll_schedule_id, require_approval } = req.body;
  if (!payments?.length) return res.status(400).json({ error: 'payments required' });
  if (!VALID_CURRENCIES.includes(currency))
    return res.status(400).json({ error: 'currency must be USDC or PYUSD' });

  const batchType = type || 'disbursement';
  const validTypes = ['disbursement', 'payroll', 'aid', 'contractor'];
  if (!validTypes.includes(batchType))
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);
  if (total <= 0) return res.status(400).json({ error: 'Total amount must be positive' });

  const fee_xlm = estimateFee(payments.length);
  const status = require_approval ? 'awaiting_approval' : 'pending';

  const { rows } = await pool.query(
    `INSERT INTO batches (org_id, type, status, total_amount, currency, recipient_count, memo, aid_program_id, payroll_schedule_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.org.id, batchType, status, total, currency, payments.length,
     memo || null, aid_program_id || null, payroll_schedule_id || null]
  );
  const batch = rows[0];

  for (const p of payments) {
    if (!p.stellar_address) return res.status(400).json({ error: 'Each payment requires stellar_address' });
    await pool.query(
      `INSERT INTO payments (batch_id, recipient_id, stellar_address, amount, currency)
       VALUES ($1,$2,$3,$4,$5)`,
      [batch.id, p.recipient_id || null, p.stellar_address, p.amount, currency]
    );
  }

  await pool.query(
    `INSERT INTO audit_logs (org_id, batch_id, action, details) VALUES ($1,$2,'batch_created',$3)`,
    [req.org.id, batch.id, JSON.stringify({ type: batchType, total, currency, count: payments.length })]
  );

  await eventPublisher.publish(Schemas.payrollCreated(batch, req.org.id));

  res.status(201).json({ batch, fee_xlm, total });
});

// POST /api/batches/:id/submit — execute on Stellar
router.post('/:id/submit', auth, batchSubmitLimiter, async (req, res) => {
  const { secret_key } = req.body;
  if (!secret_key) return res.status(400).json({ error: 'secret_key required' });

  const { rows: bRows } = await pool.query(
    'SELECT * FROM batches WHERE id=$1 AND org_id=$2', [req.params.id, req.org.id]
  );
  if (!bRows[0]) return res.status(404).json({ error: 'Batch not found' });
  if (bRows[0].status !== 'pending')
    return res.status(409).json({ error: 'Batch must be in pending status to submit' });

  const { rows: pRows } = await pool.query(
    'SELECT * FROM payments WHERE batch_id=$1 ORDER BY id', [req.params.id]
  );

  await pool.query('UPDATE batches SET status=$1 WHERE id=$2', ['submitted', req.params.id]);

  // Emit transfer initiated events
  for (const p of pRows) {
    await eventPublisher.publish({
      event_type: 'remitbridge.transfer.initiated',
      event_version: '1.0',
      source: 'remitbridge',
      timestamp: new Date().toISOString(),
      payload: {
        payment_id: p.id, batch_id: bRows[0].id, org_id: req.org.id,
        amount: p.amount, currency: p.currency, stellar_address: p.stellar_address,
      },
    });
  }

  // Respond immediately; client polls for status
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
        if (r.status === 'success') {
          successCount++;
          await eventPublisher.publish(
            Schemas.transferSettled({ ...p, tx_hash: r.tx_hash }, bRows[0].id, req.org.id)
          );
        } else {
          await eventPublisher.publish(
            Schemas.transferFailed({ ...p, error_msg: r.error }, bRows[0].id, req.org.id)
          );
        }
      }
      const finalStatus = successCount === pRows.length ? 'complete' : successCount > 0 ? 'partial' : 'failed';
      await pool.query(
        'UPDATE batches SET status=$1, submitted_at=NOW() WHERE id=$2',
        [finalStatus, req.params.id]
      );
      const finalBatch = { ...bRows[0], status: finalStatus };
      await pool.query(
        `INSERT INTO audit_logs (org_id, batch_id, action, details) VALUES ($1,$2,'batch_submitted',$3)`,
        [req.org.id, req.params.id, JSON.stringify({ successCount, total: pRows.length })]
      );
      await eventPublisher.publish(
        Schemas.payrollExecuted(finalBatch, req.org.id, successCount, pRows.length - successCount)
      );
    } catch (e) {
      await pool.query('UPDATE batches SET status=$1 WHERE id=$2', ['failed', req.params.id]);
      await eventPublisher.publish({
        event_type: 'remitbridge.payroll.failed',
        event_version: '1.0',
        source: 'remitbridge',
        timestamp: new Date().toISOString(),
        payload: { batch_id: bRows[0].id, org_id: req.org.id, error: e.message },
      });
    }
  })();
});

// GET /api/batches — list batches with pagination
router.get('/', auth, async (req, res) => {
  const { limit, offset } = parsePagination(req);
  const { status, type, currency } = req.query;
  let query = 'SELECT * FROM batches WHERE org_id=$1';
  const params = [req.org.id];
  if (status) { params.push(status); query += ` AND status=$${params.length}`; }
  if (type) { params.push(type); query += ` AND type=$${params.length}`; }
  if (currency) { params.push(currency); query += ` AND currency=$${params.length}`; }
  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await pool.query(query, params);
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

// POST /api/batches/:id/clawback — admin clawback
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

  await pool.query('UPDATE payments SET status=$1 WHERE id=$2', ['clawed_back', payment.id]);
  await pool.query(
    `INSERT INTO audit_logs (org_id, batch_id, payment_id, action, details)
     VALUES ($1,$2,$3,'clawback',$4)`,
    [req.org.id, req.params.id, payment.id,
     JSON.stringify({ payment_index, amount: payment.amount, currency: payment.currency })]
  );
  await eventPublisher.publish(Schemas.transferClawback(payment, bRows[0].id, req.org.id));
  res.json({ message: 'Clawback recorded', payment_id: payment.id });
});

// POST /api/batches/:id/cancel — cancel a pending batch
router.post('/:id/cancel', auth, async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE batches SET status='cancelled' WHERE id=$1 AND org_id=$2 AND status IN ('pending','awaiting_approval')
     RETURNING *`,
    [req.params.id, req.org.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Batch not found or cannot be cancelled' });
  await pool.query(
    `INSERT INTO audit_logs (org_id, batch_id, action) VALUES ($1,$2,'batch_cancelled')`,
    [req.org.id, req.params.id]
  );
  res.json(rows[0]);
});

module.exports = router;
