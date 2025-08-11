const { execFile } = require('child_process');

const clamscan = process.env.CLAMSCAN_PATH || 'clamscan';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

async function scanFile(filePath) {
  if (process.env.MOCK_VIRUS_SCAN === 'infected') {
    throw new Error('Virus detected');
  }
  if (process.env.MOCK_VIRUS_SCAN === 'clean') {
    return;
  }
  return new Promise((resolve, reject) => {
    execFile(clamscan, [filePath], (err) => {
      if (err) {
        if (err.code === 1) {
          return reject(new Error('Virus detected'));
        }
        return reject(new Error('Virus scan failed'));
      }
      resolve();
    });
  });
}

function validateFile(file) {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    throw Object.assign(new Error('Unsupported file type'), { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    throw Object.assign(new Error('File too large'), { status: 413 });
  }
}

module.exports = { scanFile, validateFile, MAX_FILE_SIZE, ALLOWED_TYPES };
