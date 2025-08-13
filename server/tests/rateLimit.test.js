const test = require('node:test');
const assert = require('node:assert');
require('./testEnvSetup');
const logger = require('../utils/logger');

function getApp() {
  delete require.cache[require.resolve('../index')];
  return require('../index');
}

test('IP based rate limiting works', async () => {
  process.env.ENABLE_RATE_LIMIT = 'true';
  process.env.RATE_LIMIT_PER_MINUTE = '2';
  process.env.RATE_LIMIT_WINDOW_SEC = '60';
  const app = getApp();
  const server = app.listen(0);
  const port = server.address().port;
  await fetch(`http://localhost:${port}/status`);
  await fetch(`http://localhost:${port}/status`);
  const res = await fetch(`http://localhost:${port}/status`);
  assert.strictEqual(res.status, 429);
  server.close();
});

test('API key rate limit logs event', async () => {
  process.env.ENABLE_RATE_LIMIT = 'true';
  process.env.RATE_LIMIT_PER_MINUTE = '1';
  process.env.RATE_LIMIT_WINDOW_SEC = '60';
  logger.logs.length = 0;
  const app = getApp();
  const server = app.listen(0);
  const port = server.address().port;
  const headers = { 'X-API-Key': 'abc123' };
  await fetch(`http://localhost:${port}/status`, { headers });
  const res = await fetch(`http://localhost:${port}/status`, { headers });
  assert.strictEqual(res.status, 429);
  const entry = logger.logs.find((l) => l.message === 'rate_limited');
  assert.ok(entry);
  assert.strictEqual(entry.identity_type, 'api_key');
  assert.ok(entry.request_id);
  server.close();
});

test('/healthz not limited', async () => {
  process.env.ENABLE_RATE_LIMIT = 'true';
  process.env.RATE_LIMIT_PER_MINUTE = '1';
  process.env.RATE_LIMIT_WINDOW_SEC = '60';
  const app = getApp();
  const server = app.listen(0);
  const port = server.address().port;
  for (let i = 0; i < 3; i++) {
    const res = await fetch(`http://localhost:${port}/healthz`);
    assert.strictEqual(res.status, 200);
  }
  server.close();
});
