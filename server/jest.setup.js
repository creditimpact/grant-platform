process.env.ALLOW_PARTIAL_PDF = 'true';
process.env.TMP_DIR = './tmp';
process.env.SKIP_ENGINE = 'true';
process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const tmp = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
