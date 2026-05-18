const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const StellarSdk = require('stellar-sdk');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const { pool } = require('../db');
const auth = require('../middleware/auth');

// POST /api/orgs/signup
router.post('/signup', async (req, res) => {
  const { name, country, use_case, password } = req.body;
  if (!name || !country || !use_case || !password)
    return res.status(400).json({ error: 'Missing required fields' });

  const keypair = StellarSdk.Keypair.random();
  const publicKey = keypair.publicKey();
  const secretKey = keypair.secret();

  // Fund via Friendbot
  try {
    const fb = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
    if (!fb.ok) throw new Error('Friendbot failed');
  } catch (e) {
    return res.status(502).json({ error: 'Friendbot funding failed', detail: e.message });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO orgs (name, country, use_case, stellar_public_key, password_hash)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, name, stellar_public_key`,
      [name, country, use_case, publicKey, hash]
    );
    const org = rows[0];
    const token = jwt.sign({ id: org.id, name: org.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
    // Secret shown once, never stored
    res.status(201).json({ org, token, secretKey, warning: 'Save your secret key — it will not be shown again.' });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Org already exists' });
    throw e;
  }
});

// POST /api/orgs/login
router.post('/login', async (req, res) => {
  const { name, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM orgs WHERE name=$1', [name]);
  const org = rows[0];
  if (!org || !(await bcrypt.compare(password, org.password_hash)))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: org.id, name: org.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, org: { id: org.id, name: org.name, country: org.country, use_case: org.use_case, stellar_public_key: org.stellar_public_key } });
});

// GET /api/orgs/me
router.get('/me', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, country, use_case, stellar_public_key, created_at FROM orgs WHERE id=$1',
    [req.org.id]
  );
  res.json(rows[0]);
});

module.exports = router;
