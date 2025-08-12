const test = require('node:test');
const assert = require('node:assert');

require('./testEnvSetup'); // ENV VALIDATION: seed env vars
process.env.NODE_ENV = 'test';

const app = require('../index');
const logger = require('../utils/logger');

async function getCsrf(port) {
  const res = await fetch(`http://localhost:${port}/api/auth/csrf-token`, {
    headers: { Origin: 'https://localhost:3000' },
  });
  const cookie = res.headers.get('set-cookie') || '';
  const token = cookie.split(';')[0].split('=')[1];
  return { token, cookie: cookie.split(',')[0] };
} // SECURITY FIX: helper for CSRF-protected routes

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
  const csrf = await getCsrf(port); // SECURITY FIX: obtain CSRF token for login
  const res = await fetch(`http://localhost:${port}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrf.token,
      Cookie: csrf.cookie,
      Origin: 'https://localhost:3000',
    },
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
    const csrf = await getCsrf(port); // SECURITY FIX: obtain CSRF token for login
    await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf.token,
        Cookie: csrf.cookie,
        Origin: 'https://localhost:3000',
      },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
  }
  const csrf = await getCsrf(port); // SECURITY FIX: obtain CSRF token for login
  const res = await fetch(`http://localhost:${port}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrf.token,
      Cookie: csrf.cookie,
      Origin: 'https://localhost:3000',
    },
    body: JSON.stringify({ email: 'test@example.com' }),
  });
  assert.strictEqual(res.status, 429);
  server.close();
});

test('registration validation fails for bad email', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const csrf = await getCsrf(port); // SECURITY FIX: obtain CSRF token for register
  const res = await fetch(`http://localhost:${port}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrf.token,
      Cookie: csrf.cookie,
      Origin: 'https://localhost:3000',
    },
    body: JSON.stringify({ name: 't', email: 'bad', password: 'short' }),
  });
  assert.strictEqual(res.status, 400);
  server.close();
});

// RBAC tests
const jwt = require('jsonwebtoken');
function stubFormTemplate() {
  const FormTemplate = require('../models/FormTemplate');
  FormTemplate.createVersion = async (key, template, schema) => ({
    key,
    version: 1,
    template,
    schema,
  });
  const utils = require('../utils/formTemplates');
  utils.cacheTemplate = () => {};
}

test('admin can access protected form-template route', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  stubFormTemplate();
  const csrf = await getCsrf(port);
  const token = jwt.sign(
    { userId: '1', email: 'a', role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
  const res = await fetch(`http://localhost:${port}/api/form-template`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrf.token,
      Cookie: `${csrf.cookie}; accessToken=${token}`,
      Origin: 'https://localhost:3000',
    },
    body: JSON.stringify({ key: 'sample', template: {}, schema: {} }),
  });
  assert.strictEqual(res.status, 201);
  server.close();
});

test('non-admin user is forbidden from form-template route', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  stubFormTemplate();
  const csrf = await getCsrf(port);
  const token = jwt.sign(
    { userId: '2', email: 'b', role: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
  const res = await fetch(`http://localhost:${port}/api/form-template`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrf.token,
      Cookie: `${csrf.cookie}; accessToken=${token}`,
      Origin: 'https://localhost:3000',
    },
    body: JSON.stringify({ key: 'sample', template: {}, schema: {} }),
  });
  assert.strictEqual(res.status, 403);
  server.close();
});

test('request without token is rejected', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  stubFormTemplate();
  const csrf = await getCsrf(port);
  const res = await fetch(`http://localhost:${port}/api/form-template`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrf.token,
      Cookie: csrf.cookie,
      Origin: 'https://localhost:3000',
    },
    body: JSON.stringify({ key: 'sample', template: {}, schema: {} }),
  });
  assert.strictEqual(res.status, 401);
  server.close();
});
