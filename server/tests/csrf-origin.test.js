const test = require('node:test');
const assert = require('node:assert');
require('./testEnvSetup');
const app = require('../index');
const jwt = require('jsonwebtoken');

async function getCsrf(port) {
  const res = await fetch(`http://localhost:${port}/api/auth/csrf-token`, {
    headers: { Origin: 'https://localhost:3000' },
  });
  const cookie = res.headers.get('set-cookie') || '';
  const token = cookie.split(';')[0].split('=')[1];
  return { token, cookie: cookie.split(',')[0] };
}

test('rejects requests from subdomain origin', async () => {
  const server = app.listen(0);
  const port = server.address().port;
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
      'x-csrf-token': csrf.token,
      Cookie: `${csrf.cookie}; accessToken=${token}`,
      Origin: 'https://evil.localhost:3000'
    },
    body: JSON.stringify({ test: 1 })
  });
  assert.strictEqual(res.status, 403);
  server.close();
});

test('accepts request from exact allowed origin', async () => {
  const server = app.listen(0);
  const port = server.address().port;
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
      'x-csrf-token': csrf.token,
      Cookie: `${csrf.cookie}; accessToken=${token}`,
      Origin: 'https://localhost:3000'
    },
    body: JSON.stringify({ ok: 1 })
  });
  assert.strictEqual(res.status, 200);
  server.close();
});

test('rejects when origin and referer missing', async () => {
  const server = app.listen(0);
  const port = server.address().port;
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
      'x-csrf-token': csrf.token,
      Cookie: `${csrf.cookie}; accessToken=${token}`
    },
    body: JSON.stringify({ test: 1 })
  });
  assert.strictEqual(res.status, 403);
  server.close();
});
