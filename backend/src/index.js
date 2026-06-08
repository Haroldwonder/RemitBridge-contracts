require('dotenv').config();

// Fail fast on missing critical config
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const { sanitizeBody } = require('./middleware/validate');
const { authLimiter, apiLimiter } = require('./middleware/rateLimiter');

const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

const app = express();

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));
app.use(sanitizeBody);

// Request logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health — no auth, no rate limit
app.use('/api/health', require('./routes/health'));

// Webhooks — no auth (verified by signature), no rate limit
app.use('/api/webhooks', require('./routes/webhooks'));

// Auth routes — stricter rate limit
app.use('/api/orgs', authLimiter, require('./routes/orgs'));

// All authenticated routes
app.use('/api/recipients', apiLimiter, require('./routes/recipients'));
app.use('/api/batches', apiLimiter, require('./routes/batches'));
app.use('/api/audit', apiLimiter, require('./routes/audit'));
app.use('/api/payroll', apiLimiter, require('./routes/payroll'));
app.use('/api/aid', apiLimiter, require('./routes/aid'));
app.use('/api/analytics', apiLimiter, require('./routes/analytics'));
app.use('/api/compliance', apiLimiter, require('./routes/compliance'));
app.use('/api/trustflow', apiLimiter, require('./routes/trustflow'));

// Global error handler
app.use((err, req, res, _next) => {
  const status = err.statusCode || err.status || 500;
  if (status >= 500) console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
});

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  const { flowIndexerPublisher } = require('./events/FlowIndexerPublisher');
  initDb()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`RemitBridge API on :${PORT}`);
        if (process.env.FLOW_INDEXER_URL) {
          flowIndexerPublisher.start();
          console.log('FlowIndexer event publisher started');
        }
      });
    })
    .catch(e => { console.error('DB init failed', e); process.exit(1); });
}

module.exports = app;
