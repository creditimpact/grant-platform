const { test } = require('node:test');
const assert = require('assert');
const { extractInsuranceCertificate } = require('./insuranceCertificate');

const accord25 = `CERTIFICATE OF LIABILITY INSURANCE\nACORD 25\nProducer: Alpha Insurance Agency\nInsured: My Bakery LLC\nINSR LTR A: Great Insurer NAIC#12345\nCoverages\nGeneral Liability Policy Number GL123 Eff Date 01/01/2024 Exp Date 01/01/2025 Each Occurrence $1,000,000 Aggregate $2,000,000\nCertificate Holder: City of Springfield`;

const accord27 = `EVIDENCE OF PROPERTY INSURANCE\nACORD 27\nProducer: Beta Agency\nInsured: Some Shop\nProperty Policy Number PRP456 Eff Date 02/01/2024 Exp Date 02/01/2025 Property Value $500,000\nCertificate Holder: Bank`;

test('extracts insured, producer, coverage and limits from ACORD 25', () => {
  const res = extractInsuranceCertificate({ text: accord25, hints: { form: 'ACORD25' } });
  assert.equal(res.insured.name, 'My Bakery Llc');
  assert.equal(res.producer.name, 'Alpha Insurance Agency');
  assert.equal(res.coverages[0].coverage_type, 'general_liability');
  assert.equal(res.coverages[0].effective_date, '2024-01-01');
  assert.equal(res.coverages[0].expiration_date, '2025-01-01');
  assert.equal(res.coverages[0].limits.each_occurrence, 1000000);
  assert.equal(res.coverages[0].limits.aggregate, 2000000);
  assert.deepEqual(res.warnings, []);
});

test('extracts property coverage from ACORD 27', () => {
  const res = extractInsuranceCertificate({ text: accord27, hints: { form: 'ACORD27' } });
  assert.equal(res.coverages[0].coverage_type, 'property');
  assert.equal(res.coverages[0].effective_date, '2024-02-01');
  assert.equal(res.coverages[0].expiration_date, '2025-02-01');
});
