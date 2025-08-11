let client;
try {
  client = require('prom-client');
} catch (e) {
  client = {
    Registry: class {
      metrics() { return ''; }
      get contentType() { return 'text/plain'; }
    },
    collectDefaultMetrics: () => {},
    Histogram: class {
      constructor() {}
      startTimer() { return () => {}; }
    },
  };
}

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_server_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer({
    method: req.method,
    route: req.route ? req.route.path : req.path,
  });
  res.on('finish', () => end({ status: res.statusCode }));
  next();
}

module.exports = { register, metricsMiddleware };
