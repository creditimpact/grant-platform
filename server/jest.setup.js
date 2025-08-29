process.env.ALLOW_PARTIAL_PDF = 'true';
process.env.TMP_DIR = './tmp';
process.env.NODE_ENV = 'test';
process.env.ELIGIBILITY_ENGINE_URL = 'http://localhost:4001';
process.env.ELIGIBILITY_ENGINE_PATH = '/check';
process.env.AI_ANALYZER_URL = 'http://localhost:8002';
process.env.AI_AGENT_URL = 'http://localhost:5001';
process.env.PROCESS_TEST_MODE = 'true';

const fs = require('fs');
const path = require('path');
const tmp = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });

// Log DB readiness for diagnostics in CI
try {
  const mongoose = require('mongoose');
  // eslint-disable-next-line no-console
  console.log('[jest] mongoose.readyState=', mongoose.connection?.readyState, 'SKIP_DB=', process.env.SKIP_DB);
} catch {}
// Increase default Jest timeout for integration/E2E tests
jest.setTimeout(30000);
