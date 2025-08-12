const test = require('node:test');
const assert = require('node:assert');
require('./testEnvSetup');
const { logs } = require('../utils/logger');
const jwt = require('jsonwebtoken');

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
  delete process.env.METRICS_BASIC_AUTH;
  const { server, port } = await startApp();
  const res = await fetch(`http://localhost:${port}/metrics`);
  assert.strictEqual(res.status, 404);
  server.close();
});

test('metrics route requires auth when enabled', async () => {
  process.env.OBSERVABILITY_ENABLED = 'true';
  process.env.PROMETHEUS_METRICS_ENABLED = 'true';
  process.env.METRICS_BASIC_AUTH = 'user:pass';
  const { server, port } = await startApp();
  const res = await fetch(`http://localhost:${port}/metrics`);
  assert.strictEqual(res.status, 401);
  const auth = Buffer.from('user:pass').toString('base64');
  const res2 = await fetch(`http://localhost:${port}/metrics`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  assert.strictEqual(res2.status, 200);
  server.close();
});

async function getCsrf(port) {
  const res = await fetch(`http://localhost:${port}/api/auth/csrf-token`, {
    headers: { Origin: 'https://localhost:3000' },
  });
  const cookie = res.headers.get('set-cookie') || '';
  const token = cookie.split(';')[0].split('=')[1];
  return { token, cookie: cookie.split(',')[0] };
}

test('request id echoed and logged', async () => {
  process.env.REQUEST_ID_ENABLED = 'true';
  process.env.REQUEST_LOG_JSON = 'true';
  const { server, port } = await startApp();
  const csrf = await getCsrf(port);
  const token = jwt.sign(
    { userId: '1', email: 'a', role: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
  const res = await fetch(`http://localhost:${port}/echo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': 'abc',
      'x-csrf-token': csrf.token,
      Cookie: `${csrf.cookie}; accessToken=${token}`,
      Origin: 'https://localhost:3000',
    },
    body: '{}',
  });
  assert.strictEqual(res.headers.get('x-request-id'), 'abc');
  server.close();
  const entry = logs.find((l) => l.reqId === 'abc');
  assert.ok(entry);
  assert.strictEqual(entry.status, 200);
});
