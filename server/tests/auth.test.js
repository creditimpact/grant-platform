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

test('failed login returns 400', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@example.com' }),
  });
  assert.strictEqual(res.status, 400);
  server.close();
});

test('CSRF token required for state-changing requests', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/echo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ test: 1 }),
  });
  assert.strictEqual(res.status, 403);

  const res2 = await fetch(`http://localhost:${port}/echo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': 'abc',
      Cookie: 'csrfToken=abc',
      Origin: 'https://localhost:3000',
    },
    body: JSON.stringify({ test: 1 }),
  });
  assert.strictEqual(res2.status, 200);
  server.close();
});

test('login route rate limited after 5 requests', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  for (let i = 0; i < 5; i++) {
    await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
  }
  const res = await fetch(`http://localhost:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com' }),
  });
  assert.strictEqual(res.status, 429);
  server.close();
});

test('registration validation fails for bad email', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 't', email: 'bad', password: 'short' }),
  });
  assert.strictEqual(res.status, 400);
  server.close();
});
