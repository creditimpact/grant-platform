process.env.SKIP_DB = 'true';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { execSync } = require('child_process');
const https = require('https');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const createAgent = require('../utils/tlsAgent');

test('mutual TLS allows authorized clients only', async () => {
  const tmp = fs.mkdtempSync('/tmp/mtls-');
  // generate CA
  execSync(`openssl req -x509 -nodes -new -newkey rsa:2048 -keyout ${tmp}/ca.key -out ${tmp}/ca.crt -subj "/CN=Test CA" -days 1`);
  // server cert
  execSync(`openssl req -new -newkey rsa:2048 -nodes -keyout ${tmp}/server.key -out ${tmp}/server.csr -subj "/CN=localhost"`);
  execSync(`openssl x509 -req -in ${tmp}/server.csr -CA ${tmp}/ca.crt -CAkey ${tmp}/ca.key -CAcreateserial -out ${tmp}/server.crt -days 1`);
  // client cert
  execSync(`openssl req -new -newkey rsa:2048 -nodes -keyout ${tmp}/client.key -out ${tmp}/client.csr -subj "/CN=client"`);
  execSync(`openssl x509 -req -in ${tmp}/client.csr -CA ${tmp}/ca.crt -CAkey ${tmp}/ca.key -CAcreateserial -out ${tmp}/client.crt -days 1`);

  // start server requiring client cert
  const app = require('../index');
  const server = https.createServer({
    key: fs.readFileSync(`${tmp}/server.key`),
    cert: fs.readFileSync(`${tmp}/server.crt`),
    ca: fs.readFileSync(`${tmp}/ca.crt`),
    requestCert: true,
    rejectUnauthorized: true,
  }, app).listen(0);
  const port = server.address().port;

  // allow self-signed server during test
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  // successful call with client cert
  process.env.CLIENT_CERT_PATH = `${tmp}/client.crt`;
  process.env.CLIENT_KEY_PATH = `${tmp}/client.key`;
  process.env.CLIENT_CA_PATH = `${tmp}/ca.crt`;
  const agent = createAgent();
  const ok = await fetch(`https://localhost:${port}/status`, { agent });
  assert.strictEqual(ok.status, 200);

  // failing call without client cert
  delete process.env.CLIENT_CERT_PATH;
  delete process.env.CLIENT_KEY_PATH;
  delete process.env.CLIENT_CA_PATH;
  const badAgent = createAgent();
  await assert.rejects(
    fetch(`https://localhost:${port}/status`, { agent: badAgent }),
  );

  server.close();
});
