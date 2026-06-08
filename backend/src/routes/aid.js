const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { parsePagination } = require('../middleware/validate');
const { eventPublisher } = require('../events/EventPublisher');
const { Schemas } = require('../events/EventSchemas');

// ── Aid Programs ─────────────────────────────────────────────────────────────

// GET /api/aid/programs
router.get('/programs', auth, async (req, res) => {
  const { limit, offset } = parsePagination(req);
  const { active } = req.query;
  let query = `SELECT * FROM aid_programs WHERE org_id=$1`;
  const params = [req.org.id];
  if (active !== undefined) { params.push(active === 'true'); query += ` AND active=$${params.length}`; }
  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// POST /api/aid/programs
router.post('/programs', auth, async (req, res) => {
  const { name, description, region, country, program_type, budget_total, currency, starts_at, ends_at } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const { rows } = await pool.query(
    `INSERT INTO aid_programs
       (org_id, name, description, region, country, program_type, budget_total, currency, starts_at, ends_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.org.id, name, description || null, region || null, country || null,
     program_type || 'cash', budget_total || null, currency || 'USDC', starts_at || null, ends_at || null]
  );
  await eventPublisher.publish(Schemas.aidProgramCreated(rows[0], req.org.id));
  res.status(201).json(rows[0]);
});

// GET /api/aid/programs/:id
router.get('/programs/:id', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM aid_programs WHERE id=$1 AND org_id=$2',
    [req.params.id, req.org.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// PATCH /api/aid/programs/:id
router.patch('/programs/:id', auth, async (req, res) => {
  const { name, description, active, budget_total, ends_at } = req.body;
  const { rows } = await pool.query(
    `UPDATE aid_programs
     SET name=COALESCE($1,name), description=COALESCE($2,description),
         active=COALESCE($3,active), budget_total=COALESCE($4,budget_total),
         ends_at=COALESCE($5,ends_at)
     WHERE id=$6 AND org_id=$7 RETURNING *`,
    [name, description, active, budget_total, ends_at, req.params.id, req.org.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// ── Beneficiary Groups ────────────────────────────────────────────────────────

// GET /api/aid/groups
router.get('/groups', auth, async (req, res) => {
  const { limit, offset } = parsePagination(req);
  const { rows } = await pool.query(
    `SELECT g.*, COUNT(m.recipient_id) as member_count
     FROM beneficiary_groups g
     LEFT JOIN beneficiary_group_members m ON m.group_id=g.id
     WHERE g.org_id=$1
     GROUP BY g.id ORDER BY g.created_at DESC LIMIT $2 OFFSET $3`,
    [req.org.id, limit, offset]
  );
  res.json(rows);
});

// POST /api/aid/groups
router.post('/groups', auth, async (req, res) => {
  const { name, description, region, country, aid_program_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  // Verify program belongs to this org if provided
  if (aid_program_id) {
    const { rows: pRows } = await pool.query(
      'SELECT id FROM aid_programs WHERE id=$1 AND org_id=$2',
      [aid_program_id, req.org.id]
    );
    if (!pRows[0]) return res.status(400).json({ error: 'aid_program_id not found' });
  }

  const { rows } = await pool.query(
    `INSERT INTO beneficiary_groups (org_id, aid_program_id, name, description, region, country)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.org.id, aid_program_id || null, name, description || null, region || null, country || null]
  );
  res.status(201).json(rows[0]);
});

// GET /api/aid/groups/:id/members
router.get('/groups/:id/members', auth, async (req, res) => {
  const { rows: gRows } = await pool.query(
    'SELECT id FROM beneficiary_groups WHERE id=$1 AND org_id=$2',
    [req.params.id, req.org.id]
  );
  if (!gRows[0]) return res.status(404).json({ error: 'Group not found' });

  const { rows } = await pool.query(
    `SELECT r.* FROM recipients r
     JOIN beneficiary_group_members m ON m.recipient_id=r.id
     WHERE m.group_id=$1 AND r.deleted_at IS NULL
     ORDER BY r.name`,
    [req.params.id]
  );
  res.json(rows);
});

// POST /api/aid/groups/:id/members — add recipients to a group
router.post('/groups/:id/members', auth, async (req, res) => {
  const { recipient_ids } = req.body;
  if (!Array.isArray(recipient_ids) || !recipient_ids.length)
    return res.status(400).json({ error: 'recipient_ids array required' });

  const { rows: gRows } = await pool.query(
    'SELECT id FROM beneficiary_groups WHERE id=$1 AND org_id=$2',
    [req.params.id, req.org.id]
  );
  if (!gRows[0]) return res.status(404).json({ error: 'Group not found' });

  let added = 0;
  for (const rid of recipient_ids) {
    try {
      await pool.query(
        `INSERT INTO beneficiary_group_members (group_id, recipient_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [req.params.id, rid]
      );
      added++;
    } catch {}
  }
  res.json({ added });
});

// DELETE /api/aid/groups/:id/members/:recipientId
router.delete('/groups/:id/members/:recipientId', auth, async (req, res) => {
  await pool.query(
    'DELETE FROM beneficiary_group_members WHERE group_id=$1 AND recipient_id=$2',
    [req.params.id, req.params.recipientId]
  );
  res.status(204).end();
});

// POST /api/aid/programs/:id/disburse — create a batch from a beneficiary group
router.post('/programs/:id/disburse', auth, async (req, res) => {
  const { group_id, amount_per_recipient, currency } = req.body;
  if (!group_id || !amount_per_recipient)
    return res.status(400).json({ error: 'group_id and amount_per_recipient required' });

  const disbCurrency = currency || 'USDC';
  if (!['USDC', 'PYUSD'].includes(disbCurrency))
    return res.status(400).json({ error: 'currency must be USDC or PYUSD' });

  const { rows: pRows } = await pool.query(
    'SELECT * FROM aid_programs WHERE id=$1 AND org_id=$2 AND active=true',
    [req.params.id, req.org.id]
  );
  if (!pRows[0]) return res.status(404).json({ error: 'Active program not found' });
  const program = pRows[0];

  const { rows: members } = await pool.query(
    `SELECT r.* FROM recipients r
     JOIN beneficiary_group_members m ON m.recipient_id=r.id
     WHERE m.group_id=$1 AND r.deleted_at IS NULL AND r.stellar_address IS NOT NULL`,
    [group_id]
  );
  if (!members.length) return res.status(400).json({ error: 'No eligible recipients in group' });

  const total = members.length * Number(amount_per_recipient);

  // Budget check
  if (program.budget_total !== null) {
    const remaining = Number(program.budget_total) - Number(program.budget_spent);
    if (total > remaining) {
      return res.status(400).json({ error: `Insufficient budget. Remaining: ${remaining} ${program.currency}` });
    }
  }

  const { rows: bRows } = await pool.query(
    `INSERT INTO batches (org_id, type, status, total_amount, currency, recipient_count, aid_program_id)
     VALUES ($1,'aid','pending',$2,$3,$4,$5) RETURNING *`,
    [req.org.id, total, disbCurrency, members.length, program.id]
  );
  const batch = bRows[0];

  for (const m of members) {
    await pool.query(
      `INSERT INTO payments (batch_id, recipient_id, stellar_address, amount, currency)
       VALUES ($1,$2,$3,$4,$5)`,
      [batch.id, m.id, m.stellar_address, amount_per_recipient, disbCurrency]
    );
  }

  // Update budget spent
  await pool.query(
    'UPDATE aid_programs SET budget_spent=budget_spent+$1 WHERE id=$2',
    [total, program.id]
  );

  await eventPublisher.publish(Schemas.payrollCreated(batch, req.org.id));
  res.status(201).json({ batch, payment_count: members.length, total });
});

module.exports = router;
