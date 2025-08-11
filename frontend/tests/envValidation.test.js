// ENV VALIDATION: tests for frontend env script
const { execSync } = require('child_process');
const path = require('path');

test('build fails without NEXT_PUBLIC_API_BASE', () => {
  const cwd = path.join(__dirname, '..');
  expect(() => execSync('npm run build', { cwd, env: { NODE_ENV: 'production' } })).toThrow();
});
