const router = require('express').Router();
const { pool } = require('../db');

router.get('/', async (_req, res) => {
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch {}

  const status = dbOk ? 'ok' : 'degraded';
  res.status(dbOk ? 200 : 503).json({
    status,
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: dbOk ? 'ok' : 'unreachable',
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
