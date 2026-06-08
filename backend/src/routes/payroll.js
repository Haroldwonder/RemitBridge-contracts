const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { parsePagination } = require('../middleware/validate');
const { eventPublisher } = require('../events/EventPublisher');
const { Schemas } = require('../events/EventSchemas');

// GET /api/payroll/schedules — list recurring payroll schedules
router.get('/schedules', auth, async (req, res) => {
  const { limit, offset } = parsePagination(req);
  const { rows } = await pool.query(
    `SELECT * FROM payroll_schedules WHERE org_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [req.org.id, limit, offset]
  );
  res.json(rows);
});

// POST /api/payroll/schedules — create a recurring payroll
router.post('/schedules', auth, async (req, res) => {
  const { name, currency, cron_expr, require_approval, min_approvals } = req.body;
  if (!name || !currency || !cron_expr)
    return res.status(400).json({ error: 'name, currency, and cron_expr required' });
  if (!['USDC', 'PYUSD'].includes(currency))
    return res.status(400).json({ error: 'currency must be USDC or PYUSD' });

  const { rows } = await pool.query(
    `INSERT INTO payroll_schedules (org_id, name, currency, cron_expr, require_approval, min_approvals)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.org.id, name, currency, cron_expr, require_approval || false, min_approvals || 1]
  );
  res.status(201).json(rows[0]);
});

// GET /api/payroll/schedules/:id
router.get('/schedules/:id', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM payroll_schedules WHERE id=$1 AND org_id=$2',
    [req.params.id, req.org.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// PATCH /api/payroll/schedules/:id
router.patch('/schedules/:id', auth, async (req, res) => {
  const { name, cron_expr, active, require_approval, min_approvals } = req.body;
  const { rows } = await pool.query(
    `UPDATE payroll_schedules
     SET name=COALESCE($1,name), cron_expr=COALESCE($2,cron_expr),
         active=COALESCE($3,active), require_approval=COALESCE($4,require_approval),
         min_approvals=COALESCE($5,min_approvals)
     WHERE id=$6 AND org_id=$7 RETURNING *`,
    [name, cron_expr, active, require_approval, min_approvals, req.params.id, req.org.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// DELETE /api/payroll/schedules/:id
router.delete('/schedules/:id', auth, async (req, res) => {
  await pool.query(
    'UPDATE payroll_schedules SET active=false WHERE id=$1 AND org_id=$2',
    [req.params.id, req.org.id]
  );
  res.status(204).end();
});

// GET /api/payroll/batches — payroll-type batches with pagination
router.get('/batches', auth, async (req, res) => {
  const { limit, offset } = parsePagination(req);
  const { status, currency } = req.query;
  let query = `SELECT b.*, COUNT(p.id) as payment_count
               FROM batches b LEFT JOIN payments p ON p.batch_id=b.id
               WHERE b.org_id=$1 AND b.type IN ('payroll','contractor','disbursement')`;
  const params = [req.org.id];
  if (status) { params.push(status); query += ` AND b.status=$${params.length}`; }
  if (currency) { params.push(currency); query += ` AND b.currency=$${params.length}`; }
  query += ` GROUP BY b.id ORDER BY b.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// POST /api/payroll/batches/:id/approve — approve a payroll batch
router.post('/batches/:id/approve', auth, async (req, res) => {
  const { note } = req.body;
  const { rows: bRows } = await pool.query(
    'SELECT * FROM batches WHERE id=$1 AND org_id=$2',
    [req.params.id, req.org.id]
  );
  if (!bRows[0]) return res.status(404).json({ error: 'Batch not found' });
  if (bRows[0].status !== 'awaiting_approval')
    return res.status(409).json({ error: 'Batch is not awaiting approval' });

  const { rows } = await pool.query(
    `INSERT INTO batch_approvals (batch_id, approver_id, approver_email, status, note)
     VALUES ($1,$2,$3,'approved',$4) RETURNING *`,
    [req.params.id, req.org.id, req.body.approver_email || null, note || null]
  );

  // Check if enough approvals to move to pending
  const { rows: approvals } = await pool.query(
    `SELECT s.min_approvals,
            COUNT(a.id) FILTER (WHERE a.status='approved') as approved_count
     FROM batches b
     LEFT JOIN payroll_schedules s ON s.id=b.payroll_schedule_id
     LEFT JOIN batch_approvals a ON a.batch_id=b.id
     WHERE b.id=$1
     GROUP BY s.min_approvals`,
    [req.params.id]
  );
  const { min_approvals = 1, approved_count = 0 } = approvals[0] || {};
  if (Number(approved_count) >= Number(min_approvals)) {
    await pool.query("UPDATE batches SET status='pending' WHERE id=$1", [req.params.id]);
  }

  await eventPublisher.publish(Schemas.payrollCreated(bRows[0], req.org.id));
  res.status(201).json(rows[0]);
});

// POST /api/payroll/batches/:id/reject
router.post('/batches/:id/reject', auth, async (req, res) => {
  const { note } = req.body;
  const { rows: bRows } = await pool.query(
    'SELECT * FROM batches WHERE id=$1 AND org_id=$2',
    [req.params.id, req.org.id]
  );
  if (!bRows[0]) return res.status(404).json({ error: 'Batch not found' });

  await pool.query(
    `INSERT INTO batch_approvals (batch_id, approver_id, status, note)
     VALUES ($1,$2,'rejected',$3)`,
    [req.params.id, req.org.id, note || null]
  );
  await pool.query("UPDATE batches SET status='cancelled' WHERE id=$1", [req.params.id]);
  res.json({ message: 'Batch rejected and cancelled' });
});

module.exports = router;
