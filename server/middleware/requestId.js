const { randomUUID } = require('crypto');
const onFinished = require('on-finished');
const logger = require('../utils/logger');

module.exports = function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || randomUUID();
  req.id = id;
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  const start = process.hrtime.bigint();
  onFinished(res, () => {
    const diff = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info('request', {
      requestId: id,
      method: req.method,
      route: req.originalUrl,
      status: res.statusCode,
      latencyMs: Number(diff.toFixed(3)),
    });
  });
  next();
};
