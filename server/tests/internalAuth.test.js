const test = require('node:test');
const assert = require('node:assert');
const app = require('../index');
const logger = require('../utils/logger');
require('./testEnvSetup');

function getPort(server){ return server.address().port; }

test('missing API key returns 401 and logs auth_failed', async () => {
  const server = app.listen(0);
  const port = getPort(server);
  const res = await global.rawFetch(`http://localhost:${port}/status`);
  assert.strictEqual(res.status, 401);
  const entry = logger.logs.find(l => l.message === 'auth_failed');
  assert(entry && entry.request_id);
  server.close();
});

test('wrong API key returns 401', async () => {
  const server = app.listen(0);
  const port = getPort(server);
  const res = await global.rawFetch(`http://localhost:${port}/status`, { headers: { 'X-API-Key': 'bad' } });
  assert.strictEqual(res.status, 401);
  server.close();
});

test('valid key returns 200 and X-Request-Id header', async () => {
  const server = app.listen(0);
  const port = getPort(server);
  const res = await fetch(`http://localhost:${port}/status`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.headers.get('x-request-id'));
  server.close();
});
