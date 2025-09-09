const { test } = require('node:test');
const assert = require('assert');
const { detectDocType } = require('./docType');

test('detects power of attorney', () => {
  const text = `POWER OF ATTORNEY\nI, John Doe, appoint Jane Smith as my attorney-in-fact.\nSTATE OF New York\nNotary Public\nDated January 1, 2023`;
  const res = detectDocType(text);
  assert.equal(res.type, 'power_of_attorney');
  assert.ok(res.confidence >= 0.8);
});

test('non-poa text has low confidence', () => {
  const text = `This is a generic document with no relevant legal terms.`;
  const res = detectDocType(text);
  assert.notEqual(res.type, 'power_of_attorney');
  assert.ok(res.confidence < 0.5);
});
