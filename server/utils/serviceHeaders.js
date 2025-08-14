const { randomUUID } = require('crypto');

function getServiceKey(service) {
  const map = { AI_AGENT: 'AGENT', ELIGIBILITY_ENGINE: 'ELIGIBILITY_ENGINE', AI_ANALYZER: 'AI_ANALYZER' };
  const prefix = map[service] || service;
  return process.env[`${prefix}_NEXT_API_KEY`] || process.env[`${prefix}_API_KEY`];
}

function getServiceHeaders(service, req) {
  const key = getServiceKey(service);
  const requestId = (req && req.id) || randomUUID();
  return { 'X-API-Key': key, 'X-Request-Id': requestId };
}

module.exports = { getServiceKey, getServiceHeaders };
