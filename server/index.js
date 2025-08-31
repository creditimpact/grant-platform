// server/index.js

require('dotenv').config();
console.log("ELIGIBILITY_ENGINE_URL =", process.env.ELIGIBILITY_ENGINE_URL);

const env = require('./config/env');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./utils/db');

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

const draftsDir = process.env.DRAFTS_DIR || '/tmp/forms';
app.use('/forms', express.static(draftsDir));

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

app.use('/api', require('./routes/pipeline'));
const caseRouter = require('./routes/case');
app.use('/api', caseRouter);
app.get('/case/status', caseRouter.caseStatusHandler);
app.use('/api', require('./routes/formTemplate'));
app.use('/api', require('./routes/files'));
app.use('/api', require('./routes/eligibility'));
app.use('/api', require('./routes/questionnaire'));
app.use(require('./routes/documents'));

const PORT = env.PORT || 5000;

function startServer() {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
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
}

module.exports = app;
