const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const FormData = require('form-data');

require('./testEnvSetup');
process.env.NODE_ENV = 'test';
process.env.MOCK_VIRUS_SCAN = 'clean';

const app = require('../index');
const { validateFile, scanFile } = require('../utils/virusScanner');

async function getAuth(port) {
  const res = await fetch(`http://localhost:${port}/api/auth/csrf-token`, {
    headers: { Origin: 'https://localhost:3000' },
  });
  const cookie = res.headers.get('set-cookie') || '';
  const csrfToken = cookie.split(';')[0].split('=')[1];
  const accessToken = jwt.sign({ userId: 'u1', email: 't@example.com' }, process.env.JWT_SECRET);
  const authCookie = `${cookie.split(',')[0]}; accessToken=${accessToken}`;
  return { token: csrfToken, cookie: authCookie };
}

test('POST /api/files/upload requires auth', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const resCsrf = await fetch(`http://localhost:${port}/api/auth/csrf-token`, {
    headers: { Origin: 'https://localhost:3000' },
  });
  const cookie = resCsrf.headers.get('set-cookie') || '';
  const csrfToken = cookie.split(';')[0].split('=')[1];
  const form = new FormData();
  form.append('key', 'doc');
  form.append('file', Buffer.from('data'), { filename: 'doc.pdf', contentType: 'application/pdf' });
  const res = await fetch(`http://localhost:${port}/api/files/upload`, {
    method: 'POST',
    body: form,
    headers: { ...form.getHeaders(), 'x-csrf-token': csrfToken, Cookie: cookie.split(',')[0], Origin: 'https://localhost:3000' },
  });
  assert.strictEqual(res.status, 401);
  server.close();
});

test('validateFile rejects unsupported type', () => {
  assert.throws(() => validateFile({ mimetype: 'text/plain', size: 10 }), /Unsupported file type/);
});

test('validateFile rejects large files', () => {
  assert.throws(() => validateFile({ mimetype: 'application/pdf', size: 5 * 1024 * 1024 + 1 }), /File too large/);
});

test('scanFile rejects infected files', async () => {
  process.env.MOCK_VIRUS_SCAN = 'infected';
  await assert.rejects(() => scanFile('dummy'), /Virus detected/);
  process.env.MOCK_VIRUS_SCAN = 'clean';
});
