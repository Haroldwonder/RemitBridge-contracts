const router = require('express').Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const StellarSdk = require('stellar-sdk');
const { pool } = require('../db');
const auth = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function isValidStellarAddress(addr) {
  try { StellarSdk.StrKey.decodeEd25519PublicKey(addr); return true; } catch { return false; }
}

// GET /api/recipients
router.get('/', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM recipients WHERE org_id=$1 ORDER BY created_at DESC',
    [req.org.id]
  );
  res.json(rows);
});

// POST /api/recipients
router.post('/', auth, async (req, res) => {
  const { name, email, stellar_address, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  if (stellar_address && !isValidStellarAddress(stellar_address))
    return res.status(400).json({ error: 'Invalid Stellar address' });
  const { rows } = await pool.query(
    `INSERT INTO recipients (org_id, name, email, stellar_address, phone) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.org.id, name, email, stellar_address, phone]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/recipients/:id
router.put('/:id', auth, async (req, res) => {
  const { name, email, stellar_address, phone } = req.body;
  if (stellar_address && !isValidStellarAddress(stellar_address))
    return res.status(400).json({ error: 'Invalid Stellar address' });
  const { rows } = await pool.query(
    `UPDATE recipients SET name=COALESCE($1,name), email=COALESCE($2,email),
     stellar_address=COALESCE($3,stellar_address), phone=COALESCE($4,phone)
     WHERE id=$5 AND org_id=$6 RETURNING *`,
    [name, email, stellar_address, phone, req.params.id, req.org.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// DELETE /api/recipients/:id
router.delete('/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM recipients WHERE id=$1 AND org_id=$2', [req.params.id, req.org.id]);
  res.status(204).end();
});

// POST /api/recipients/csv
router.post('/csv', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
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
      `INSERT INTO recipients (org_id, name, email, stellar_address, phone)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING *`,
      [req.org.id, r.name, r.email || null, r.stellar_address || null, r.phone || null]
    );
    if (rows[0]) inserted.push(rows[0]);
  }
  res.json({ inserted: inserted.length, errors });
});

module.exports = router;
