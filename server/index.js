// server/index.js

// ENV VALIDATION: ensure env variables are validated before anything else
const env = require('./config/env'); // ENV VALIDATION
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./utils/db');
const path = require('path');
const fs = require('fs');
const https = require('https');
const logger = require('./utils/logger');
const rateLimit = require('./middleware/rateLimit');
const { csrfProtection } = require('./middleware/csrf');

// ENV VALIDATION: dotenv already loaded in env.js, but keep for safety
dotenv.config();

// Initialize Express app
const app = express();

// === Middlewares ===
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info('http', { message: message.trim() }),
    },
  })
);

app.use(rateLimit({ windowMs: 60 * 60 * 1000, max: 1000 }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 60 }));

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect('https://' + req.headers.host + req.originalUrl);
  }
  next();
});

app.use(csrfProtection);
// SECURITY FIX: removed public static serving of uploads

// simple echo endpoint for tests and health checks
app.post('/echo', (req, res) => {
  res.json(req.body || {});
});

// === Root & Health Routes ===
app.get('/', (req, res) => {
  res.send('🚀 Grant Platform API is running!');
});

app.get('/status', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

// === API Routes ===
app.use('/api/auth', require('./routes/auth'));
logger.info('Auth routes registered');
app.use('/api/users', require('./routes/users'));
// Unified grant submission pipeline
app.use('/api', require('./routes/pipeline'));
// Case management & document routes
app.use('/api', require('./routes/case'));
// Form template management
app.use('/api', require('./routes/formTemplate'));

// === Connect to DB and start server ===
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
    https
      .createServer(options, app)
      .listen(PORT, () => logger.info(`HTTPS server running on port ${PORT}`));
  } else {
    app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  }
}

if (process.env.SKIP_DB !== 'true') {
  connectDB()
    .then(startServer)
    .catch((err) => {
      logger.error('Failed to connect to MongoDB', { error: err.message });
      process.exit(1); // Exit process if DB fails
    });
}

module.exports = app;
