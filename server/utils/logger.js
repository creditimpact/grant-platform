// SECURITY FIX: add recursive PII redaction and suppress info logs in production
const crypto = require('crypto');
const logs = [];
const PII_PATTERNS = [/name/i, /email/i, /address/i, /phone/i, /ssn/i, /password/i, /token/i];
const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const IP_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

function anonymizeIp(ip) {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 8);
}

function mask(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (IP_REGEX.test(obj)) return anonymizeIp(obj);
    if (EMAIL_REGEX.test(obj)) return '[REDACTED]';
    return obj;
  }
  if (Array.isArray(obj)) return obj.map((v) => mask(v));
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (/ip/i.test(k) && typeof v === 'string') {
        out[k] = anonymizeIp(v);
      } else if (PII_PATTERNS.some((p) => p.test(k))) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = mask(v);
      }
    }
    return out;
  }
  return obj;
}

function log(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...mask(meta),
  };
  if (process.env.NODE_ENV === 'test') {
    logs.push(entry);
  } else if (process.env.NODE_ENV === 'development' || level !== 'info') {
    console.log(JSON.stringify(entry));
  }
}

module.exports = {
  // SECURITY FIX: expose helpers that only log in non-production environments
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  audit: (action, details) => log('audit', action, details),
  logs,
};
