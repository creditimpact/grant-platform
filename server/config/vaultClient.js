import dotenv from 'dotenv';
import Vault from 'node-vault';
import https from 'https';
import { URL } from 'url';

// טוען את משתני הסביבה מקובץ .env
dotenv.config();

// יצירת לקוח Vault עם הגדרות מהסביבה
const vault = Vault({
  apiVersion: 'v1',
  endpoint: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
  token: process.env.VAULT_TOKEN,
});

/**
 * טוען סודות מ-Vault באמצעות קריאה ישירה ב-HTTPS.
 * מבצע בדיקה ש-VAULT_ADDR משתמש בפרוטוקול HTTPS בלבד.
 * מטען את הסודות ל-process.env ומטפל בשגיאות בצורה סינכרונית.
 */
function loadVaultSecrets() {
  const addr = process.env.VAULT_ADDR;
  const token = process.env.VAULT_TOKEN;
  const secretPath = process.env.VAULT_SECRET_PATH;

  if (!addr || !token || !secretPath) {
    throw new Error('VAULT_ADDR, VAULT_TOKEN and VAULT_SECRET_PATH must be set');
  }

  const url = new URL(`/v1/${secretPath}`, addr);

  if (url.protocol !== 'https:') {
    throw new Error('VAULT_ADDR must use https protocol');
  }

  let error;
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);

  const req = https.request(
    url,
    { headers: { 'X-Vault-Token': token } },
    (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          error = new Error(`Vault responded with status ${res.statusCode}`);
        } else {
          try {
            const json = JSON.parse(body);
            const data = json.data?.data ?? json.data ?? {};
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

export { vault, loadVaultSecrets };
