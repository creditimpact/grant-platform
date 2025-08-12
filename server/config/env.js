// ENV VALIDATION: centralized environment validation without external deps
const fs = require('fs');
const { URL } = require('url');
const dotenv = require('dotenv');

dotenv.config();

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
  return ["1", "true", "yes"].includes(val.toLowerCase());
}

// Required secrets
requireString('JWT_SECRET');
requireString('INTERNAL_API_KEY');
requireString('OPENAI_API_KEY');

// URLs
requireHTTPSURL('FRONTEND_URL');
requireHTTPSURL('ELIGIBILITY_ENGINE_URL');
requireHTTPSURL('AI_ANALYZER_URL');
requireHTTPSURL('AI_AGENT_URL');

// MongoDB
requireURL('MONGO_URI');
requireString('MONGO_USER');
requireString('MONGO_PASS');
requirePath('MONGO_CA_FILE');

// TLS
requirePath('TLS_KEY_PATH');
requirePath('TLS_CERT_PATH');
if (process.env.TLS_CA_PATH) requirePath('TLS_CA_PATH');
if (process.env.CLIENT_CERT_PATH) requirePath('CLIENT_CERT_PATH');
if (process.env.CLIENT_KEY_PATH) requirePath('CLIENT_KEY_PATH');
if (process.env.CLIENT_CA_PATH) requirePath('CLIENT_CA_PATH');

// PORT
const PORT = requireInt('PORT');

// Booleans
const ENABLE_DEBUG = getBool('ENABLE_DEBUG');
const SKIP_DB = getBool('SKIP_DB');

module.exports = { PORT, ENABLE_DEBUG, SKIP_DB };
