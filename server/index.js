// server/index.js

// ===== Load & Validate ENV =====
const env = require('./config/env'); // Loads .env and validates values
console.log('=== Loaded ENV Variables ===');
console.log({
  PORT: env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  FRONTEND_URL: process.env.FRONTEND_URL,
  MONGO_URI: process.env.MONGO_URI ? '[LOADED]' : '[MISSING]',
  JWT_SECRET: process.env.JWT_SECRET ? '[LOADED]' : '[MISSING]',
  VAULT_ADDR: process.env.VAULT_ADDR,
  VAULT_TOKEN: process.env.VAULT_TOKEN ? '[SET]' : '[MISSING]',
  VAULT_SECRET_PATH: process.env.VAULT_SECRET_PATH,
});
console.log('=============================');

// ===== Core Dependencies =====
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./utils/db');
const path = require('path');
const fs = require('fs');
const https = require('https');

// ===== Middleware & Utilities =====
const logger = require('./utils/logger');
const rateLimit = require('./middleware/rateLimit');
const { csrfProtection } = require('./middleware/csrf');
const requestId = require('./middleware/requestId');
const internalAuth = require('./middleware/internalAuth');
const authMiddleware = require('./middleware/authMiddleware');

// ===== Observability =====
const { metricsMiddleware, register } =
  process.env.OBSERVABILITY_ENABLED === 'true' &&
  process.env.PROMETHEUS_METRICS_ENABLED === 'true'
    ? require('./observability/metrics')
    : { metricsMiddleware: null, register: null };

const tracing = require('./observability/tracing');

// ===== Initialize Express =====
const app = express();
tracing.init();

// ===== Global Middlewares =====
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(requestId);
app.use(internalAuth);

if (metricsMiddleware) app.use(metricsMiddleware);

app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info('http', { message: message.trim() }),
  },
}));

// ===== Rate Limiting =====
app.use(rateLimit({ windowMs: 60 * 60 * 1000, max: 1000 }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 60 }));

// ===== Security Headers =====
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
    logger.warn('insecure_request', { host: req.headers.host, url: req.originalUrl });
    return res.redirect('https://' + req.headers.host + req.originalUrl);
  }

  next();
});

app.use(csrfProtection);

// ===== Core Routes =====
app.post('/echo', authMiddleware, (req, res) => {
  res.json(req.body || {});
});

if (metricsMiddleware) {
  const creds = process.env.METRICS_BASIC_AUTH || '';
  const expected = creds ? Buffer.from(creds).toString('base64') : null;

  app.get('/metrics', (req, res) => {
    const header = req.headers['authorization'] || '';
    if (!expected || header !== `Basic ${expected}`) {
      return res.status(401)
        .set('WWW-Authenticate', 'Basic realm="metrics"')
        .end();
    }
    res.set('Content-Type', register.contentType);
    res.end(register.metrics());
  });
}

// ===== Health Check =====
const securityReady = [
  process.env.AGENT_API_KEY,
  process.env.ELIGIBILITY_ENGINE_API_KEY,
  process.env.AI_ANALYZER_API_KEY,
].every(Boolean);

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/readyz', (req, res) => {
  if (!securityReady) return res.status(503).json({ status: 'not_ready' });
  res.json({ status: 'ok' });
});

app.get('/status', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

// ===== API Routes =====
app.use('/api/auth', require('./routes/auth'));
logger.info('Auth routes registered');
app.use('/api/users', require('./routes/users'));
app.use('/api', require('./routes/pipeline'));
app.use('/api', require('./routes/case'));
app.use('/api', require('./routes/formTemplate'));

// ===== Start Server =====
const PORT = env.PORT || 5000;

function startServer() {
  const keyPath = process.env.TLS_KEY_PATH;
  const certPath = process.env.TLS_CERT_PATH;

  if (keyPath && certPath) {
    const options = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
      ca: process.env.TLS_CA_PATH ? fs.readFileSync(process.env.TLS_CA_PATH) : undefined,
      requestCert: true,
      rejectUnauthorized: true,
    };

    https.createServer(options, app).listen(PORT, () => {
      logger.info(`🔐 HTTPS server running on port ${PORT}`);
    });
  } else {
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
    });
  }
}

if (process.env.SKIP_DB !== 'true') {
  connectDB()
    .then(startServer)
    .catch((err) => {
      logger.error('❌ Failed to connect to MongoDB', { error: err.message });
      process.exit(1);
    });
}

module.exports = app;
