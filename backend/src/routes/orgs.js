const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const StellarSdk = require('stellar-sdk');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { eventPublisher } = require('../events/EventPublisher');
const { Schemas } = require('../events/EventSchemas');

const USE_TESTNET = process.env.STELLAR_NETWORK !== 'mainnet';

// POST /api/orgs/signup
router.post('/signup', async (req, res) => {
  const { name, email, country, use_case, password } = req.body;
  if (!name || !country || !use_case || !password)
    return res.status(400).json({ error: 'Missing required fields: name, country, use_case, password' });
  if (!['ngo', 'employer', 'remittance'].includes(use_case))
    return res.status(400).json({ error: 'use_case must be: ngo, employer, or remittance' });
  if (password.length < 8)
    return res.status(400).json({ error: 'password must be at least 8 characters' });

  const keypair = StellarSdk.Keypair.random();
  const publicKey = keypair.publicKey();
  const secretKey = keypair.secret();

  // Fund via Friendbot on testnet only
  if (USE_TESTNET) {
    try {
      const fb = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
      if (!fb.ok) throw new Error('Friendbot failed');
    } catch (e) {
      return res.status(502).json({ error: 'Friendbot funding failed', detail: e.message });
    }
  }

  const hash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await pool.query(
      `INSERT INTO orgs (name, email, country, use_case, stellar_public_key, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email, country, use_case, stellar_public_key`,
      [name, email || null, country, use_case, publicKey, hash]
    );
    const org = rows[0];
    const token = jwt.sign({ id: org.id, name: org.name }, process.env.JWT_SECRET, { expiresIn: '7d' });

    await eventPublisher.publish(Schemas.orgCreated(org));

    // Secret shown once, never stored
    res.status(201).json({
      org, token, secretKey,
      warning: 'Save your secret key — it will not be shown again.',
    });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Org already exists' });
    throw e;
  }
});

// POST /api/orgs/login
router.post('/login', async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'name and password required' });

  const { rows } = await pool.query('SELECT * FROM orgs WHERE name=$1', [name]);
  const org = rows[0];
  if (!org || !(await bcrypt.compare(password, org.password_hash)))
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: org.id, name: org.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({
    token,
    org: {
      id: org.id, name: org.name, email: org.email,
      country: org.country, use_case: org.use_case,
      stellar_public_key: org.stellar_public_key,
      trustflow_org_id: org.trustflow_org_id,
    },
  });
});

// GET /api/orgs/me
router.get('/me', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, country, use_case, stellar_public_key, trustflow_org_id, created_at FROM orgs WHERE id=$1',
    [req.org.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Org not found' });
  res.json(rows[0]);
});

// PATCH /api/orgs/me — update profile
router.patch('/me', auth, async (req, res) => {
  const { email, country } = req.body;
  const { rows } = await pool.query(
    `UPDATE orgs SET email=COALESCE($1,email), country=COALESCE($2,country)
     WHERE id=$3 RETURNING id, name, email, country, use_case, stellar_public_key`,
    [email, country, req.org.id]
  );
  res.json(rows[0]);
});

module.exports = router;
