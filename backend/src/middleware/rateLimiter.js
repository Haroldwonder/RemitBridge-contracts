/**
 * Simple in-process rate limiter using a sliding window counter.
 * For production use a Redis-backed store (e.g., rate-limiter-flexible).
 */

const windows = new Map();

function createRateLimiter({ windowMs = 60000, max = 60, keyFn = (req) => req.ip } = {}) {
  return function rateLimiter(req, res, next) {
    const key = keyFn(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!windows.has(key)) windows.set(key, []);
    const hits = windows.get(key).filter(ts => ts > windowStart);
    hits.push(now);
    windows.set(key, hits);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - hits.length));
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));

    if (hits.length > max) {
      return res.status(429).json({
        error: 'Too many requests',
        retry_after: Math.ceil(windowMs / 1000),
      });
    }
    next();
  };
}

// Auth endpoint: 10 req/min per IP
const authLimiter = createRateLimiter({ windowMs: 60000, max: 10 });

// API endpoints: 120 req/min per org
const apiLimiter = createRateLimiter({
  windowMs: 60000,
  max: 120,
  keyFn: req => req.org?.id ? `org:${req.org.id}` : req.ip,
});

// Batch submission: 5 submissions/min per org (Stellar ops are expensive)
const batchSubmitLimiter = createRateLimiter({
  windowMs: 60000,
  max: 5,
  keyFn: req => req.org?.id ? `batch_submit:${req.org.id}` : req.ip,
});

module.exports = { createRateLimiter, authLimiter, apiLimiter, batchSubmitLimiter };
