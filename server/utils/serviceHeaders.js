function getServiceKey(service) {
  return process.env[`${service}_NEXT_API_KEY`] || process.env[`${service}_API_KEY`];
}

function getServiceHeaders(service) {
  const key = getServiceKey(service);
  return { 'X-API-Key': key };
}

module.exports = { getServiceKey, getServiceHeaders };
