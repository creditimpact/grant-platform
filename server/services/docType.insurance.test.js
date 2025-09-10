const { test } = require('node:test');
const assert = require('assert');
const { detectDocType } = require('./docType');

const accord25 = `CERTIFICATE OF LIABILITY INSURANCE\nACORD 25\nProducer: Alpha Agency\nInsured: My Biz\nInsurers Affording Coverage\nCoverages\nPolicy Number\nEff Date\nExp Date\nCertificate Holder`;
const accord27 = `EVIDENCE OF PROPERTY INSURANCE\nACORD 27\nProducer: Beta Agency\nInsured: Some Biz\nCoverages\nPolicy Number\nEff Date\nExp Date\nCertificate Holder`;
const resumeText = `W-9 Form\nRequest for Taxpayer Identification Number`;

test('detects ACORD 25 insurance certificate', () => {
  const res = detectDocType(accord25);
  assert.equal(res.type, 'insurance_certificate');
  assert.ok(res.confidence >= 0.9);
  assert.equal(res.hints.form, 'ACORD25');
});

test('detects ACORD 27 insurance certificate', () => {
  const res = detectDocType(accord27);
  assert.equal(res.type, 'insurance_certificate');
  assert.ok(res.confidence >= 0.9);
  assert.equal(res.hints.form, 'ACORD27');
});

test('non-insurance docs have low confidence', () => {
  const res = detectDocType(resumeText);
  assert.notEqual(res.type, 'insurance_certificate');
  assert.ok(res.confidence < 0.5);
});
