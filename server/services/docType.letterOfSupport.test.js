const { test } = require('node:test');
const assert = require('assert');
const { detectDocType } = require('./docType');

const body = 'John Doe is an outstanding member of our community and has contributed greatly. '
  .repeat(20);
const letterText = `Letter of Support\n\nDear Grant Committee,\n${body}\nSincerely,\nJane Smith\nDirector, City Org\n555-123-4567\njane@city.org`;

const resumeText = `JOHN DOE\njohn@example.com | (555) 123-4567\n\nSUMMARY OF QUALIFICATIONS\nSkilled engineer.`;
const invoiceText = `Invoice\nAmount Due: $100\nThank you for your business.`;
const insuranceText = `CERTIFICATE OF LIABILITY INSURANCE\nProducer: ABC Agency\nPolicy Number: 123`;

test('detects letter of support documents', () => {
  const res = detectDocType(letterText);
  assert.equal(res.type, 'letter_of_support');
  assert.ok(res.confidence >= 0.9);
});

test('non-letters have low confidence', () => {
  for (const t of [resumeText, invoiceText, insuranceText]) {
    const res = detectDocType(t);
    assert.ok(res.type !== 'letter_of_support' || res.confidence < 0.5);
  }
});
