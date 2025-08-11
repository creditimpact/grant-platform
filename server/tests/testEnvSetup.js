// ENV VALIDATION: helper to seed required env vars for tests
const dummy = __filename;
process.env.JWT_SECRET = 'test';
process.env.INTERNAL_API_KEY = 'test';
process.env.OPENAI_API_KEY = 'test';
process.env.FRONTEND_URL = 'https://localhost:3000';
process.env.ELIGIBILITY_ENGINE_URL = 'http://localhost';
process.env.AI_ANALYZER_URL = 'http://localhost';
process.env.AI_AGENT_URL = 'http://localhost';
process.env.MONGO_URI = 'mongodb://localhost:27017';
process.env.MONGO_USER = 'u';
process.env.MONGO_PASS = 'p';
process.env.MONGO_CA_FILE = dummy;
process.env.TLS_KEY_PATH = dummy;
process.env.TLS_CERT_PATH = dummy;
process.env.PORT = '0';
process.env.SKIP_DB = 'true';
