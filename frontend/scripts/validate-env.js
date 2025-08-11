// ENV VALIDATION: frontend build-time env validation
const { URL } = require('url');

function requireEnv(name) {
  const val = process.env[name];
  if (!val) {
    console.error(`Missing required environment variable ${name}`);
    process.exit(1);
  }
  return val;
}

function requireURL(name) {
  const val = requireEnv(name);
  try {
    new URL(val);
  } catch {
    console.error(`Invalid URL for environment variable ${name}`);
    process.exit(1);
  }
}

requireEnv('NODE_ENV');
requireURL('NEXT_PUBLIC_API_BASE');
