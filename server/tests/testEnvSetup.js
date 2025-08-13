// ENV VALIDATION: helper to seed required env vars for tests
const dummy = __filename;
process.env.JWT_SECRET = 'test';
process.env.AGENT_API_KEY = 'test';
process.env.AI_AGENT_API_KEY = 'test';
process.env.AI_ANALYZER_API_KEY = 'test';
process.env.ELIGIBILITY_ENGINE_API_KEY = 'test';
process.env.OPENAI_API_KEY = 'test';
process.env.FRONTEND_URL = 'https://localhost:3000';
process.env.ELIGIBILITY_ENGINE_URL = 'https://localhost';
process.env.AI_ANALYZER_URL = 'https://localhost';
process.env.AI_AGENT_URL = 'https://localhost';
process.env.MONGO_URI = 'mongodb://localhost:27017';
process.env.TLS_KEY_PATH = dummy;
process.env.TLS_CERT_PATH = dummy;
process.env.PORT = '1';
process.env.SKIP_DB = 'true';
process.env.ENABLE_RATE_LIMIT = 'false';

const originalFetch = global.fetch;
global.rawFetch = originalFetch;
global.fetch = (url, opts = {}) => {
  opts.headers = { ...(opts.headers || {}), 'X-API-Key': process.env.AI_AGENT_API_KEY };
  return originalFetch(url, opts);
};
