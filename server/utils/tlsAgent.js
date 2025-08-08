const fs = require('fs');
const https = require('https');

/**
 * Create an HTTPS agent using client certificates for mutual TLS.
 * If required environment variables are missing, returns undefined
 * so callers can fall back to default behavior.
 */
module.exports = function createAgent() {
  const cert = process.env.CLIENT_CERT_PATH;
  const key = process.env.CLIENT_KEY_PATH;
  if (!cert || !key) return undefined;
  const ca = process.env.CLIENT_CA_PATH;
  return new https.Agent({
    cert: fs.readFileSync(cert),
    key: fs.readFileSync(key),
    ca: ca ? fs.readFileSync(ca) : undefined,
    rejectUnauthorized: true,
  });
};
