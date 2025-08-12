const https = require('https');
const { URL } = require('url');

function loadVaultSecrets() {
  const addr = process.env.VAULT_ADDR;
  const token = process.env.VAULT_TOKEN;
  const secretPath = process.env.VAULT_SECRET_PATH;
  if (!addr || !token || !secretPath) return;

  const url = new URL(`/v1/${secretPath}`, addr);
  if (url.protocol !== 'https:') {
    throw new Error('VAULT_ADDR must use https');
  }

  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  let error;

  const req = https.request(
    url,
    { headers: { 'X-Vault-Token': token } },
    (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          error = new Error(`Vault responded with status ${res.statusCode}`);
        } else {
          try {
            const json = JSON.parse(body);
            const data = json.data && json.data.data ? json.data.data : json.data || {};
            Object.assign(process.env, data);
          } catch (e) {
            error = new Error(`Invalid Vault response: ${e.message}`);
          }
        }
        Atomics.store(view, 0, 1);
        Atomics.notify(view, 0);
      });
    }
  );
  req.on('error', (err) => {
    error = err;
    Atomics.store(view, 0, 1);
    Atomics.notify(view, 0);
  });
  req.end();
  Atomics.wait(view, 0, 0);
  if (error) {
    throw new Error(`Failed to load secrets from Vault: ${error.message}`);
  }
}

module.exports = { loadVaultSecrets };
