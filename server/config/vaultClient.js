// vaultClient.js

import dotenv from 'dotenv';
import Vault from 'node-vault';
import { execSync } from 'child_process';

// טוען את משתני הסביבה מקובץ .env
dotenv.config();

const vault = Vault({
  apiVersion: 'v1', // גרסת API של Vault
  endpoint: process.env.VAULT_ADDR || 'http://127.0.0.1:8200', // כתובת Vault
  token: process.env.VAULT_TOKEN, // טוקן לקריאה מ־env variables
});

/**
 * פונקציה אלטרנטיבית לטעינת סודות מ-Vault דרך curl (execSync)
 * שימוש במידה ואין אינטגרציה ישירה ב-node-vault
 */
function loadVaultSecrets() {
  const addr = process.env.VAULT_ADDR || 'http://127.0.0.1:8200';
  const token = process.env.VAULT_TOKEN;
  const path = process.env.VAULT_SECRET_PATH;
  if (!token || !path) return;

  const url = `${addr}/v1/${path}`;
  try {
    const out = execSync(`curl -s -H "X-Vault-Token: ${token}" ${url}`);
    const json = JSON.parse(out.toString());
    const data = json.data && json.data.data ? json.data.data : json.data || {};
    Object.assign(process.env, data);
  } catch (err) {
    throw new Error(`Failed to load secrets from Vault: ${err.message}`);
  }
}

export { vault, loadVaultSecrets };
