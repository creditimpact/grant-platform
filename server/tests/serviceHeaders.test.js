const test = require('node:test');
const assert = require('node:assert');
const { getServiceHeaders } = require('../utils/serviceHeaders');

test('uses current key when next not set', () => {
  process.env.AI_ANALYZER_API_KEY = 'a';
  delete process.env.AI_ANALYZER_NEXT_API_KEY;
  const headers = getServiceHeaders('AI_ANALYZER');
  assert.strictEqual(headers['X-API-Key'], 'a');
});

test('uses next key when set', () => {
  process.env.AI_ANALYZER_API_KEY = 'a';
  process.env.AI_ANALYZER_NEXT_API_KEY = 'b';
  const headers = getServiceHeaders('AI_ANALYZER');
  assert.strictEqual(headers['X-API-Key'], 'b');
});
