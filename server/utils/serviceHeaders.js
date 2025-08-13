function getServiceKey(service) {
  const map = { AI_AGENT: 'AGENT', ELIGIBILITY_ENGINE: 'ELIGIBILITY_ENGINE', AI_ANALYZER: 'AI_ANALYZER' };
  const prefix = map[service] || service;
  return process.env[`${prefix}_NEXT_API_KEY`] || process.env[`${prefix}_API_KEY`];
}

function getServiceHeaders(service, req) {
  const key = getServiceKey(service);
  const headers = { 'X-API-Key': key };
  if (req && req.id) headers['X-Request-Id'] = req.id;
  return headers;
}

module.exports = { getServiceKey, getServiceHeaders };
