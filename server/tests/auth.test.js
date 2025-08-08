const test = require('node:test');
const assert = require('node:assert');

process.env.SKIP_DB = 'true';

const app = require('../index');

// accessing protected route without token should be rejected

test('GET /api/users requires auth', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/users`);
  assert.strictEqual(res.status, 401);
  server.close();
});
