// Load environment variables from .env early
require('dotenv').config();

const fs = require('fs');
const { URL } = require('url');

// Load secrets from Vault only in production
if (process.env.NODE_ENV === 'production') {
  const { loadVaultSecrets } = require('./vaultClient');
  loadVaultSecrets();
} else {
  console.log('🔹 Development mode detected – loading secrets from .env instead of Vault');
}

// === Validation Utilities ===
function requireString(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable ${name}`);
  return val;
}

function requireURL(name) {
  const val = requireString(name);
  try {
    new URL(val);
    return val;
  } catch {
    throw new Error(`Invalid URL for environment variable ${name}`);
  }
}

function requireHTTPSURL(name) {
  const val = requireString(name);
  try {
    const url = new URL(val);
    if (url.protocol !== 'https:') throw new Error();
    return val;
  } catch {
    throw new Error(`Invalid HTTPS URL for environment variable ${name}`);
  }
}

function requirePath(name) {
  const val = requireString(name);
  if (!fs.existsSync(val)) {
    throw new Error(`File not found for ${name}: ${val}`);
  }
  return val;
}

function requireInt(name) {
  const val = requireString(name);
  const num = Number(val);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }
  return num;
}

function getBool(name, def = false) {
  const val = process.env[name];
  if (val === undefined) return def;
  return ['1', 'true', 'yes'].includes(val.toLowerCase());
}

// === Required Secrets ===
requireString('JWT_SECRET');
requireString('AI_AGENT_API_KEY');
requireString('AI_ANALYZER_API_KEY');
requireString('ELIGIBILITY_ENGINE_API_KEY');
requireString('OPENAI_API_KEY');

// === URLs ===
// In production, enforce HTTPS; in development, allow HTTP
const urlValidator = process.env.NODE_ENV === 'production' ? requireHTTPSURL : requireURL;
urlValidator('FRONTEND_URL');
urlValidator('ELIGIBILITY_ENGINE_URL');
urlValidator('AI_ANALYZER_URL');
urlValidator('AI_AGENT_URL');

// === MongoDB ===
requireURL('MONGO_URI');
if (process.env.NODE_ENV === 'production') {
  requireString('MONGO_USER');
  requireString('MONGO_PASS');
  requirePath('MONGO_CA_FILE');
} else {
  console.log('🔹 Skipping MongoDB credentials & CA file check in development');
}

// === TLS (Production only) ===
if (process.env.NODE_ENV === 'production') {
  requirePath('TLS_KEY_PATH');
  requirePath('TLS_CERT_PATH');
  if (process.env.TLS_CA_PATH) requirePath('TLS_CA_PATH');
  if (process.env.CLIENT_CERT_PATH) requirePath('CLIENT_CERT_PATH');
  if (process.env.CLIENT_KEY_PATH) requirePath('CLIENT_KEY_PATH');
  if (process.env.CLIENT_CA_PATH) requirePath('CLIENT_CA_PATH');
}

// === Misc ===
const PORT = requireInt('PORT');
const ENABLE_DEBUG = getBool('ENABLE_DEBUG');
const SKIP_DB = getBool('SKIP_DB');

module.exports = { PORT, ENABLE_DEBUG, SKIP_DB };
