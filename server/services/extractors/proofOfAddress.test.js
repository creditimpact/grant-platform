const { test } = require('node:test');
const assert = require('assert');
const { extractProofOfAddress } = require('./proofOfAddress');

test('extracts address and date', () => {
  const text = `City of Springfield Water\nStatement Date: August 7, 2025\nService Address: 123 Main St Apt 4B, Springfield, IL 62701\nAccount Number: ****8921`;
  const res = extractProofOfAddress({ text, hints: { evidence_type: 'utility_bill' } });
  assert.equal(res.address.line1, '123 Main St Apt 4B');
  assert.equal(res.address.city, 'Springfield');
  assert.equal(res.address.state, 'IL');
  assert.equal(res.document_date, '2025-08-07');
  assert.equal(res.account_number, '****8921');
  assert.equal(res.evidence_type, 'utility_bill');
});
