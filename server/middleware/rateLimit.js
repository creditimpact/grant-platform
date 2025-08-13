const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const ipaddr = require('ipaddr.js');
const logger = require('../utils/logger');

function hash(val) {
  return crypto.createHash('sha256').update(val).digest('hex').slice(0, 8);
}

function parseWhitelist(list) {
  return (list || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function ipInCidr(ip, cidr) {
  try {
    const addr = ipaddr.parse(ip);
    if (cidr.includes('/')) {
      const [range, bits] = cidr.split('/');
      const subnet = ipaddr.parse(range);
      return addr.match(subnet, parseInt(bits, 10));
    }
    return addr.toString() === ipaddr.parse(cidr).toString();
  } catch {
    return false;
  }
}

module.exports = function createRateLimiter() {
  if (process.env.ENABLE_RATE_LIMIT === 'false') {
    return (req, res, next) => next();
  }
  const windowSec = parseInt(process.env.RATE_LIMIT_WINDOW_SEC || '60', 10);
  const limit = parseInt(process.env.RATE_LIMIT_PER_MINUTE || '100', 10);
  const whitelist = parseWhitelist(process.env.RATE_LIMIT_WHITELIST);
  const exempt = new Set(['/healthz', '/readyz', '/metrics']);

  return rateLimit({
    windowMs: windowSec * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const key = req.headers['x-api-key'];
      if (key) return 'api:' + hash(key);
      const auth = req.headers['authorization'];
      if (auth && auth.startsWith('Bearer ')) return 'jwt:' + hash(auth.slice(7));
      return 'ip:' + (req.ip || '');
    },
    skip: (req) => {
      if (exempt.has(req.path)) return true;
      const id = req.headers['x-service-name'];
      if (id && whitelist.includes(id)) return true;
      const ip = req.ip;
      return whitelist.some((w) => ipInCidr(ip, w));
    },
    handler: (req, res, next, opts) => {
      const retry = Math.ceil(opts.windowMs / 1000);
      res.set('Retry-After', String(retry));
      res.status(429).json({ error: 'rate_limited', retry_after: retry });
      const keyHeader = req.headers['x-api-key'];
      const auth = req.headers['authorization'];
      const identity_type = keyHeader
        ? 'api_key'
        : auth && auth.startsWith('Bearer ')
        ? 'jwt'
        : 'ip';
      logger.warn('rate_limited', {
        request_id: req.id,
        service: 'server',
        path: req.path,
        method: req.method,
        remote_ip: req.ip,
        identity_type,
        limit,
        window_sec: windowSec,
      });
    },
  });
};
