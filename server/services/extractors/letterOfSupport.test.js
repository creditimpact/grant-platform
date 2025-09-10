const { test } = require('node:test');
const assert = require('assert');
const { extractLetterOfSupport } = require('./letterOfSupport');

const letter = `Letter of Support\nDated: July 1, 2024\n\nDear Grant Committee,\nI have worked with John Doe for three years at City Youth Org and know his dedication to service. John is always eager to help and demonstrates leadership.\n[signature image]\nSincerely,\nJane Smith\nDirector of Outreach, City Youth Org\n555-123-4567\njane@city.org`;

test('extracts fields from letter of support', () => {
  const res = extractLetterOfSupport({ text: letter, confidence: 0.92 });
  assert.equal(res.doc_type, 'letter_of_support');
  assert.equal(res.recipient, 'Grant Committee');
  assert.equal(res.author.full_name, 'Jane Smith');
  assert.equal(res.author.title, 'Director Of Outreach');
  assert.equal(res.author.organization, 'City Youth Org');
  assert.ok(res.author.contact.includes('555-123-4567'));
  assert.ok(res.relationship.startsWith('I have worked with John Doe'));
  assert.ok(res.endorsement_text.includes('John is always eager'));
  assert.equal(res.signature_block.closing, 'Sincerely,');
  assert.ok(res.signature_block.has_signature_image);
  assert.equal(res.document_date, '2024-07-01');
  assert.equal(res.confidence, 0.92);
});
