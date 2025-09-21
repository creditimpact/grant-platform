const { test } = require('node:test');
const assert = require('assert');
const { detectDocType } = require('./docType');

test('detects DD-214 certificate', () => {
  const text = `DD Form 214\nCertificate of Release or Discharge from Active Duty\nDepartment of Defense\nArmed Forces\nService Branch: Army\nDischarge: Honorable`;
  const res = detectDocType(text);
  assert.equal(res.type, 'veteran_status_form');
  assert.equal(res.hints.form, 'dd214_certificate');
  assert.ok(res.confidence >= 0.9);
});

test('detects DD-214 application', () => {
  const text = `Application for Certified Copy of Military Discharge\nDepartment of Defense\nEligibility: I am the veteran\nApplicant Information\nNotary Public`;
  const res = detectDocType(text);
  assert.equal(res.type, 'veteran_status_form');
  assert.equal(res.hints.form, 'dd214_application');
  assert.ok(res.confidence >= 0.8);
});

test('non veteran document has low confidence', () => {
  const text = `W-9 Form\nRequest for Taxpayer Identification Number`;
  const res = detectDocType(text);
  assert.notEqual(res.type, 'veteran_status_form');
  assert.ok(res.confidence < 0.5);
});
