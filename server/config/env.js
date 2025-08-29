const path = require('path');
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = process.env.ENV_FILE || path.resolve(__dirname, '..', `.env.${nodeEnv}`);
try {
  require('dotenv').config({ path: envFile });
} catch (err) {
  // dotenv is optional in test environments
}

process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost';
process.env.ELIGIBILITY_ENGINE_URL =
  process.env.ELIGIBILITY_ENGINE_URL || 'http://localhost:4001';
process.env.ELIGIBILITY_ENGINE_PATH =
  process.env.ELIGIBILITY_ENGINE_PATH || '/check';
process.env.AI_ANALYZER_URL = process.env.AI_ANALYZER_URL || 'http://localhost:8002';
process.env.AI_AGENT_URL = process.env.AI_AGENT_URL || 'http://localhost:9001';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';
process.env.PORT = process.env.PORT || '3000';

const { URL } = require('url');

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

function requireInt(name) {
  const val = requireString(name);
  const num = Number(val);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }
  return num;
}

requireURL('FRONTEND_URL');
requireURL('ELIGIBILITY_ENGINE_URL');
requireURL('AI_ANALYZER_URL');
requireURL('AI_AGENT_URL');
requireURL('MONGO_URI');

const PORT = requireInt('PORT');
const ENABLE_DEBUG = false;
const SKIP_DB = process.env.SKIP_DB === 'true';

module.exports = { PORT, ENABLE_DEBUG, SKIP_DB };
