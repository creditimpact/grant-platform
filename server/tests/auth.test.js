const test = require('node:test');
const assert = require('node:assert');

process.env.SKIP_DB = 'true';
process.env.NODE_ENV = 'test';

const app = require('../index');
const logger = require('../utils/logger');

// accessing protected route without token should be rejected

test('GET /api/users requires auth', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/users`);
  assert.strictEqual(res.status, 401);
  server.close();
});

test('audit log for failed login', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  logger.logs.length = 0;
  const res = await fetch(`http://localhost:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@example.com' }),
  });
  assert.strictEqual(res.status, 400);
  const entry = logger.logs.find((l) => l.level === 'audit' && l.message === 'auth.login.failure');
  assert(entry);
  assert.strictEqual(entry.email, 'nobody@example.com');
  assert.strictEqual(entry.password, undefined);
  server.close();
});
