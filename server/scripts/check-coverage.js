const fs = require('fs');
const logger = require('../utils/logger');
const text = fs.readFileSync(process.argv[2], 'utf8');
const match = text.match(/# all files\s*\|\s*(\d+\.\d+)\s*\|\s*(\d+\.\d+)\s*\|\s*(\d+\.\d+)\s*\|/);
if (!match) {
  logger.error('coverage_summary_missing');
  process.exit(1);
}
const lines = parseFloat(match[1]);
const branches = parseFloat(match[2]);
const funcs = parseFloat(match[3]);
const threshold = 50; // coverage threshold
if (lines < threshold || branches < threshold || funcs < threshold) {
  logger.error('coverage_below_threshold', { lines, branches, funcs });
  process.exit(1);
}
logger.info('coverage_check_passed', { lines, branches, funcs });

