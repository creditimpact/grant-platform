// ENV VALIDATION: tests for environment validation module
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

test('env validation fails when required vars missing', () => {
  const result = spawnSync('node', ['-e', "require('./config/env')"], { cwd: root, env: {} });
  assert.notEqual(result.status, 0);
});

test('env validation parses values', () => {
  const dummy = path.join(__filename);
  const env = {
    JWT_SECRET: 'a',
    INTERNAL_API_KEY: 'b',
    OPENAI_API_KEY: 'c',
    FRONTEND_URL: 'https://example.com',
    ELIGIBILITY_ENGINE_URL: 'https://example.com',
    AI_ANALYZER_URL: 'https://example.com',
    AI_AGENT_URL: 'https://example.com',
    MONGO_URI: 'mongodb://localhost:27017',
    MONGO_USER: 'u',
    MONGO_PASS: 'p',
    MONGO_CA_FILE: dummy,
    TLS_KEY_PATH: dummy,
    TLS_CERT_PATH: dummy,
    PORT: '1234',
  };
  const result = spawnSync(process.execPath, ['-e', "const env=require('./config/env');console.log(env.PORT)"], { cwd: root, env: { ...env, PATH: process.env.PATH } });
  assert.strictEqual(result.status, 0);
  assert(result.stdout.toString().includes('1234'));
});
