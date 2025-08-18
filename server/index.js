// server/index.js

const env = require('./config/env');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./utils/db');
const path = require('path');
const fs = require('fs');
const https = require('https');

const logger = require('./utils/logger');
const requestId = require('./middleware/requestId');

const { metricsMiddleware, register } =
  process.env.OBSERVABILITY_ENABLED === 'true' &&
  process.env.PROMETHEUS_METRICS_ENABLED === 'true'
    ? require('./observability/metrics')
    : { metricsMiddleware: null, register: null };

const tracing = require('./observability/tracing');

const app = express();
tracing.init();

app.use(cors());
app.use(express.json());
app.use(requestId);

if (metricsMiddleware) app.use(metricsMiddleware);

app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info('http', { message: message.trim() }),
    },
  })
);

app.post('/echo', (req, res) => {
  res.json(req.body || {});
});

if (metricsMiddleware) {
  app.get('/metrics', (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(register.metrics());
  });
}

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/readyz', (req, res) => {
  res.json({ status: 'ready' });
});

app.get('/status', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api', require('./routes/pipeline'));
app.use('/api', require('./routes/case'));
app.use('/api', require('./routes/formTemplate'));

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
      logger.info(`HTTPS server running on port ${PORT}`);
    });
  } else {
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  }
}

if (process.env.SKIP_DB !== 'true') {
  connectDB()
    .then(() => {
      startServer();
    })
    .catch((err) => {
      logger.error('Failed to connect to MongoDB', { error: err.stack });
      process.exit(1);
    });
} else {
  startServer();
}

module.exports = app;
