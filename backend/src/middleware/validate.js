/**
 * Request validation helpers.
 */

function requireFields(fields) {
  return (req, res, next) => {
    const missing = fields.filter(f => {
      const val = req.body[f];
      return val === undefined || val === null || val === '';
    });
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }
    next();
  };
}

function requirePositiveNumber(field) {
  return (req, res, next) => {
    const val = Number(req.body[field]);
    if (isNaN(val) || val <= 0) {
      return res.status(400).json({ error: `${field} must be a positive number` });
    }
    next();
  };
}

function sanitizeString(val, maxLen = 500) {
  if (typeof val !== 'string') return val;
  return val.trim().slice(0, maxLen);
}

function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }
  }
  next();
}

function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

module.exports = { requireFields, requirePositiveNumber, sanitizeBody, parsePagination };
