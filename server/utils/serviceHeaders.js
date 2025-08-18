const { randomUUID } = require('crypto');

function getServiceHeaders(service, req) {
  const requestId = (req && req.id) || randomUUID();
  return { 'X-Request-Id': requestId };
}

module.exports = { getServiceHeaders };
