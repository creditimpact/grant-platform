process.env.ALLOW_PARTIAL_PDF = 'true';
process.env.TMP_DIR = './tmp';
process.env.NODE_ENV = 'test';
process.env.ELIGIBILITY_ENGINE_URL = 'http://localhost:5000';
process.env.AI_ANALYZER_URL = 'http://localhost:8002';
process.env.AI_AGENT_URL = 'http://localhost:5001';

const fs = require('fs');
const path = require('path');
const tmp = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
