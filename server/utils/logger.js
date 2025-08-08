const logs = [];
const SENSITIVE_FIELDS = ['password', 'token', 'apiKey'];

function redact(obj) {
  if (!obj) return obj;
  const clone = { ...obj };
  SENSITIVE_FIELDS.forEach((key) => {
    if (clone[key] !== undefined) {
      clone[key] = '[REDACTED]';
    }
  });
  return clone;
}

function log(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...redact(meta),
  };
  if (process.env.NODE_ENV === 'test') {
    logs.push(entry);
  } else {
    console.log(JSON.stringify(entry));
  }
}

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  audit: (action, details) => log('audit', action, details),
  logs,
};
