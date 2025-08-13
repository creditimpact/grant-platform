const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

const BYPASS = ['/healthz', '/readyz', '/metrics'];

module.exports = function internalAuth(req, res, next) {
  if (req.method === 'GET' && BYPASS.includes(req.path)) return next();
  const allowed = [
    process.env.AGENT_API_KEY,
    process.env.ELIGIBILITY_ENGINE_API_KEY,
    process.env.AI_ANALYZER_API_KEY,
  ].filter(Boolean);
  const provided = req.headers['x-api-key'];
  if (!allowed.includes(provided)) {
    const id = req.id || res.locals.requestId || randomUUID();
    res.setHeader('X-Request-Id', id);
    logger.warn('auth_failed', {
      request_id: id,
      service: 'server',
      path: req.originalUrl,
      method: req.method,
      remote_ip: req.ip,
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
