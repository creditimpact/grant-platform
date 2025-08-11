// SECURITY FIX: add recursive PII redaction and suppress info logs in production
const logs = [];
const PII_PATTERNS = [/name/i, /email/i, /address/i, /phone/i, /ssn/i, /password/i, /token/i, /apikey/i];

function mask(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((v) => mask(v));
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = PII_PATTERNS.some((p) => p.test(k)) ? '[REDACTED]' : mask(v);
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
