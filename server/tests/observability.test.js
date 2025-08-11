const test = require('node:test');
const assert = require('node:assert');
require('./testEnvSetup');
const { logs } = require('../utils/logger');

async function startApp() {
  delete require.cache[require.resolve('../index')];
  const app = require('../index');
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      logs.length = 0;
      resolve({ server, port: server.address().port });
    });
  });
}

test('metrics route disabled by default', async () => {
  delete process.env.OBSERVABILITY_ENABLED;
  delete process.env.PROMETHEUS_METRICS_ENABLED;
  const { server, port } = await startApp();
  const res = await fetch(`http://localhost:${port}/metrics`);
  assert.strictEqual(res.status, 404);
  server.close();
});

test('metrics route enabled with flags', async () => {
  process.env.OBSERVABILITY_ENABLED = 'true';
  process.env.PROMETHEUS_METRICS_ENABLED = 'true';
  const { server, port } = await startApp();
  const res = await fetch(`http://localhost:${port}/metrics`);
  assert.strictEqual(res.status, 200);
  server.close();
});

test('request id echoed and logged', async () => {
  process.env.REQUEST_ID_ENABLED = 'true';
  process.env.REQUEST_LOG_JSON = 'true';
  const { server, port } = await startApp();
  const res = await fetch(`http://localhost:${port}/echo`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'abc' }, body: '{}' });
  assert.strictEqual(res.headers.get('x-request-id'), 'abc');
  server.close();
  const entry = logs.find((l) => l.reqId === 'abc');
  assert.ok(entry);
  assert.strictEqual(entry.status, 200);
});
