const test = require('node:test');
const assert = require('node:assert');

// ensure module can load and populate env vars

test('loadVaultSecrets merges secrets', () => {
  const child_process = require('child_process');
  const original = child_process.execSync;
  child_process.execSync = () =>
    Buffer.from(JSON.stringify({ data: { data: { JWT_SECRET: 'vault' } } }));
  process.env.VAULT_TOKEN = 't';
  process.env.VAULT_SECRET_PATH = 'secret/data/path';
  delete require.cache[require.resolve('../config/vaultClient')];
  const { loadVaultSecrets } = require('../config/vaultClient');
  loadVaultSecrets();
  assert.strictEqual(process.env.JWT_SECRET, 'vault');
  child_process.execSync = original;
});
