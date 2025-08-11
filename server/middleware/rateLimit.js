const logger = require('../utils/logger');

function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip + ':' + req.path;
    let entry = hits.get(key);
    if (!entry) {
      entry = { count: 1, start: now };
      hits.set(key, entry);
    } else {
      if (now - entry.start > windowMs) {
        entry.count = 1;
        entry.start = now;
      } else {
        entry.count += 1;
      }
    }
    if (entry.count > max) {
      logger.warn('rate-limit', { ip: req.ip, path: req.path });
      return res.status(429).json({ message: message || 'Too many requests' });
    }
    next();
  };
}

module.exports = rateLimit;
