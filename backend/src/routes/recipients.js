const router = require('express').Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const StellarSdk = require('stellar-sdk');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { parsePagination } = require('../middleware/validate');
const { eventPublisher } = require('../events/EventPublisher');
const { Schemas } = require('../events/EventSchemas');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function isValidStellarAddress(addr) {
  try { StellarSdk.StrKey.decodeEd25519PublicKey(addr); return true; } catch { return false; }
}

// GET /api/recipients — paginated list with optional search
router.get('/', auth, async (req, res) => {
  const { limit, offset } = parsePagination(req);
  const { search, kyc_status, country } = req.query;

  let query = `SELECT * FROM recipients WHERE org_id=$1 AND deleted_at IS NULL`;
  const params = [req.org.id];

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR stellar_address ILIKE $${params.length})`;
  }
  if (kyc_status) { params.push(kyc_status); query += ` AND kyc_status=$${params.length}`; }
  if (country) { params.push(country); query += ` AND country=$${params.length}`; }
  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// POST /api/recipients
router.post('/', auth, async (req, res) => {
  const { name, email, stellar_address, phone, country } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  if (stellar_address && !isValidStellarAddress(stellar_address))
    return res.status(400).json({ error: 'Invalid Stellar address' });

  const { rows } = await pool.query(
    `INSERT INTO recipients (org_id, name, email, stellar_address, phone, country)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.org.id, name, email || null, stellar_address || null, phone || null, country || null]
  );
  await eventPublisher.publish(Schemas.beneficiaryCreated(rows[0], req.org.id));
  res.status(201).json(rows[0]);
});

// GET /api/recipients/:id
router.get('/:id', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM recipients WHERE id=$1 AND org_id=$2 AND deleted_at IS NULL',
    [req.params.id, req.org.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// PUT /api/recipients/:id
router.put('/:id', auth, async (req, res) => {
  const { name, email, stellar_address, phone, country } = req.body;
  if (stellar_address && !isValidStellarAddress(stellar_address))
    return res.status(400).json({ error: 'Invalid Stellar address' });

  const { rows } = await pool.query(
    `UPDATE recipients SET
       name=COALESCE($1,name), email=COALESCE($2,email),
       stellar_address=COALESCE($3,stellar_address), phone=COALESCE($4,phone),
       country=COALESCE($5,country)
     WHERE id=$6 AND org_id=$7 AND deleted_at IS NULL RETURNING *`,
    [name, email, stellar_address, phone, country, req.params.id, req.org.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  await eventPublisher.publish({
    event_type: 'remitbridge.beneficiary.updated',
    event_version: '1.0',
    source: 'remitbridge',
    timestamp: new Date().toISOString(),
    payload: { recipient_id: rows[0].id, org_id: req.org.id },
  });
  res.json(rows[0]);
});

// DELETE /api/recipients/:id — soft delete
router.delete('/:id', auth, async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE recipients SET deleted_at=NOW() WHERE id=$1 AND org_id=$2 AND deleted_at IS NULL RETURNING id',
    [req.params.id, req.org.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// POST /api/recipients/csv — bulk upload
router.post('/csv', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!req.file.mimetype?.includes('csv') && !req.file.originalname?.endsWith('.csv')) {
    return res.status(400).json({ error: 'File must be a CSV' });
  }

  const records = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
  if (records.length > 500) return res.status(400).json({ error: 'Max 500 rows' });

  const errors = [];
  const valid = [];
  for (const [i, r] of records.entries()) {
    if (!r.name) { errors.push({ row: i + 2, error: 'name required' }); continue; }
    if (r.stellar_address && !isValidStellarAddress(r.stellar_address)) {
      errors.push({ row: i + 2, error: `Invalid Stellar address: ${r.stellar_address}` }); continue;
    }
    valid.push(r);
  }

  const inserted = [];
  for (const r of valid) {
    const { rows } = await pool.query(
      `INSERT INTO recipients (org_id, name, email, stellar_address, phone, country)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING *`,
      [req.org.id, r.name, r.email || null, r.stellar_address || null, r.phone || null, r.country || null]
    );
    if (rows[0]) {
      inserted.push(rows[0]);
      await eventPublisher.publish(Schemas.beneficiaryCreated(rows[0], req.org.id));
    }
  }
  res.json({ inserted: inserted.length, errors });
});

module.exports = router;
