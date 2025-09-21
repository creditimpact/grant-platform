const { test } = require('node:test');
const assert = require('assert');
const { extractVeteranStatus } = require('./veteranStatus');

test('extracts fields from DD-214 certificate', () => {
  const text = `DD Form 214\nCertificate of Release or Discharge from Active Duty\nDepartment of Defense\nName: John Doe\nService Branch: Army\nDate Entered Active Duty: 01/01/2000\nSeparation Date: 01/01/2004\nCharacter of Service: Honorable\nSSN: 123-45-6789`;
  const res = extractVeteranStatus({ text, hints: { form: 'dd214_certificate' } });
  assert.equal(res.veteran_name, 'John Doe');
  assert.equal(res.service_branch, 'Army');
  assert.equal(res.service_start_date, '2000-01-01');
  assert.equal(res.service_end_date, '2004-01-01');
  assert.equal(res.discharge_status, 'Honorable');
  assert.equal(res.ssn_last4, '6789');
  assert.ok(new Date(res.service_end_date) > new Date(res.service_start_date));
});

test('extracts fields from DD-214 application', () => {
  const text = `Application for Certified Copy of Military Discharge\nDepartment of Defense\nApplicant Name: Jane Smith\nRelationship to Veteran: Spouse\nEligibility: I am the spouse of the veteran.\nNotary Public: Alan Agent\nState of California\nMy commission expires 12/31/2025`;
  const res = extractVeteranStatus({ text, hints: { form: 'dd214_application' } });
  assert.equal(res.applicant_name, 'Jane Smith');
  assert.equal(res.applicant_relationship, 'spouse');
  assert.equal(res.eligibility_basis, 'I am the spouse of the veteran.');
  assert.equal(res.notary.full_name, 'Alan Agent');
  assert.equal(res.notary.state, 'California');
  assert.equal(res.notary.commission_expires, '2025-12-31');
});
