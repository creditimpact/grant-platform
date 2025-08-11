// SECURITY FIX: use Redis-backed store with in-memory fallback
const logger = require('../utils/logger');
let Redis;
try {
  Redis = require('ioredis'); // SECURITY FIX: optional Redis dependency
} catch {
  Redis = null;
}
const redis = Redis && process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;
const hits = new Map();

function rateLimit({ windowMs, max, message }) {
  return async (req, res, next) => {
    const key = `rl:${req.ip}:${req.path}`;
    try {
      let count;
      if (redis) {
        count = await redis.incr(key);
        if (count === 1) {
          await redis.pexpire(key, windowMs);
        }
      } else {
        const now = Date.now();
        let entry = hits.get(key);
        if (!entry || now - entry.start > windowMs) {
          entry = { count: 0, start: now };
        }
        entry.count += 1;
        entry.start = entry.start || now;
        hits.set(key, entry);
        count = entry.count;
      }
      if (count > max) {
        logger.warn('rate-limit', { ip: req.ip, path: req.path }); // SECURITY FIX: log abuse attempts
        return res.status(429).json({ message: message || 'Too many requests' });
      }
      next();
    } catch (err) {
      logger.error('rate-limit failure', { error: err.message }); // SECURITY FIX: capture Redis errors
      next();
    }
  };
}

module.exports = rateLimit;
