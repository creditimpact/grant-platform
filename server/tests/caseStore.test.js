const test = require('node:test');
const assert = require('node:assert');
const { computeDocuments } = require('../utils/caseStore');

test('base document requirements', async () => {
  const docs = await computeDocuments({});
  const keys = docs.map(d => d.key);
  assert(keys.includes('business_tax_returns'));
  assert(keys.includes('financial_statements'));
  assert(keys.includes('bank_statements'));
  assert(keys.includes('business_registration'));
  assert(keys.includes('insurance_certificate'));
});

test('corporation requires incorporation docs', async () => {
  const docs = await computeDocuments({ entityType: 'Corporation' });
  const keys = docs.map(d => d.key);
  assert(keys.includes('articles_incorporation'));
  assert(keys.includes('ein_document'));
});

test('employees trigger payroll records', async () => {
  const docs = await computeDocuments({ employees: 5 });
  const keys = docs.map(d => d.key);
  assert(keys.includes('payroll_records'));
});

test('previous grants require documentation', async () => {
  const docs = await computeDocuments({ previousGrants: true });
  const keys = docs.map(d => d.key);
  assert(keys.includes('previous_grant_docs'));
});
