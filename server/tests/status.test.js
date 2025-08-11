const test = require('node:test');
const assert = require('node:assert');
require('./testEnvSetup'); // ENV VALIDATION
const app = require('../index');

test('GET /status returns ok', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/status`);
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.status, 'ok');
  server.close();
});
