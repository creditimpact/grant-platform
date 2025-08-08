const fs = require('fs');
const text = fs.readFileSync(process.argv[2], 'utf8');
const match = text.match(/# all files\s*\|\s*(\d+\.\d+)\s*\|\s*(\d+\.\d+)\s*\|\s*(\d+\.\d+)\s*\|/);
if (!match) {
  console.error('Coverage summary not found');
  process.exit(1);
}
const lines = parseFloat(match[1]);
const branches = parseFloat(match[2]);
const funcs = parseFloat(match[3]);
const threshold = 50; // coverage threshold
if (lines < threshold || branches < threshold || funcs < threshold) {
  console.error(`Coverage below threshold: lines ${lines}, branches ${branches}, funcs ${funcs}`);
  process.exit(1);
}
console.log(`Coverage check passed: lines ${lines}, branches ${branches}, funcs ${funcs}`);

