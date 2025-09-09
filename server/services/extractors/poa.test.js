const { test } = require('node:test');
const assert = require('assert');
const { extractPOA } = require('./poa');

test('extracts core poa fields', () => {
  const text = `POWER OF ATTORNEY\nI, John Doe, appoint Jane Smith as my attorney-in-fact.\nWitness: Mark Witness\nState of New York\nCounty of Kings\nNotary Public: Nancy Notary\nCommission No: 12345\nDated January 1, 2023`;
  const poa = extractPOA({ text });
  assert.equal(poa.doc_type, 'power_of_attorney');
  assert.equal(poa.principals[0].full_name, 'John Doe');
  assert.equal(poa.agents[0].full_name, 'Jane Smith');
  assert.equal(poa.execution.signed_date, '2023-01-01');
  assert.equal(poa.execution.notary.full_name, 'Nancy Notary');
  assert.equal(poa.execution.witnesses[0].full_name, 'Mark Witness');
});
