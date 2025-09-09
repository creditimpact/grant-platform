const { test } = require('node:test');
const assert = require('assert');
const { detectDocType } = require('./docType');

test('detects utility bill as proof of address', () => {
  const text = `Comcast\nStatement Date: Jan 5, 2024\nService Address: 123 Main St, Springfield, IL 62701\nAccount Number: 12345\nAmount Due: $50.00`;
  const res = detectDocType(text);
  assert.equal(res.type, 'proof_of_address');
  assert.ok(res.confidence >= 0.8);
  assert.equal(res.hints.evidence_type, 'utility_bill');
});

test('non-poa document has low confidence', () => {
  const text = 'Invoice #123 for services rendered.';
  const res = detectDocType(text);
  assert.notEqual(res.type, 'proof_of_address');
  assert.ok(res.confidence < 0.5);
});
