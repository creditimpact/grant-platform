const test = require('node:test');
const assert = require('node:assert');
const FormData = require('form-data');

require('./testEnvSetup');
process.env.NODE_ENV = 'test';

const app = require('../index');

async function getCsrf(port) {
  const res = await fetch(`http://localhost:${port}/api/auth/csrf-token`);
  const cookie = res.headers.get('set-cookie') || '';
  const token = cookie.split(';')[0].split('=')[1];
  return { cookie: cookie.split(',')[0], token };
}

test('submit-case rejects missing CSRF', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const form = new FormData();
  const res = await fetch(`http://localhost:${port}/api/submit-case`, { method: 'POST', body: form });
  assert.strictEqual(res.status, 403);
  server.close();
});

test('submit-case requires auth', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const csrf = await getCsrf(port);
  const form = new FormData();
  form.append('businessName', 'Biz');
  form.append('email', 'user@example.com');
  const res = await fetch(`http://localhost:${port}/api/submit-case`, {
    method: 'POST',
    headers: {
      ...form.getHeaders(),
      'x-csrf-token': csrf.token,
      Cookie: csrf.cookie,
      Origin: 'https://localhost:3000',
    },
    body: form,
  });
  assert.strictEqual(res.status, 401);
  server.close();
});
