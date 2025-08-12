// vaultClient.js

import dotenv from 'dotenv';
import Vault from 'node-vault';

// טוען את משתני הסביבה מקובץ .env
dotenv.config();

const vault = Vault({
  apiVersion: 'v1', // גרסת API של Vault
  endpoint: process.env.VAULT_ADDR || 'http://127.0.0.1:8200', // כתובת Vault
  token: process.env.VAULT_TOKEN, // טוקן לקריאה מ־env variables
});

export default vault;
