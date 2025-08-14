// server/index.js

// ===== Load & Validate ENV =====
const env = require('./config/env'); // Loads .env and validates values
console.log('DEBUG_STARTUP: Environment variables loaded');
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
const createRateLimiter = require('./middleware/rateLimit');
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
const allowedOrigins =
  process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [process.env.FRONTEND_URL, process.env.ADMIN_URL].filter(Boolean);
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-Id'],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(requestId);
app.use(internalAuth);

if (metricsMiddleware) app.use(metricsMiddleware);

app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info('http', { message: message.trim() }),
  },
}));

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// ===== Rate Limiting =====
app.use(createRateLimiter());

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
  const checks = {};

  checks.security = securityReady ? 'ok' : 'missing_keys';

  if (process.env.SKIP_DB === 'true') {
    checks.mongo = 'skipped';
  } else {
    const state = require('mongoose').connection.readyState;
    checks.mongo = state === 1 ? 'ok' : 'disconnected';
  }

  if (
    process.env.DISABLE_VAULT === 'true' ||
    process.env.NODE_ENV !== 'production'
  ) {
    checks.vault = 'skipped';
  } else {
    const hasVault =
      process.env.VAULT_ADDR &&
      process.env.VAULT_TOKEN &&
      process.env.VAULT_SECRET_PATH;
    checks.vault = hasVault ? 'ok' : 'missing';
  }

  const ready = Object.values(checks).every(
    (v) => v === 'ok' || v === 'skipped'
  );
  const status = ready ? 'ready' : 'not_ready';
  const code = ready ? 200 : 503;
  res.status(code).json({ status, checks });
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

    console.log('DEBUG_STARTUP: Before calling app.listen (HTTPS)');
    https.createServer(options, app).listen(PORT, () => {
      logger.info(`🔐 HTTPS server running on port ${PORT}`);
      console.log('DEBUG_STARTUP: Server running');
    });
  } else {
    console.log('DEBUG_STARTUP: Before calling app.listen');
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      console.log('DEBUG_STARTUP: Server running');
    });
  }
}

if (process.env.SKIP_DB !== 'true') {
  console.log('DEBUG_STARTUP: Before connecting to MongoDB');
  connectDB()
    .then(() => {
      console.log('DEBUG_STARTUP: MongoDB connection successful');
      startServer();
    })
    .catch((err) => {
      logger.error('❌ Failed to connect to MongoDB', { error: err.message });
      process.exit(1);
    });
}

module.exports = app;
