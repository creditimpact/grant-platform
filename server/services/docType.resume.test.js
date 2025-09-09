const { test } = require('node:test');
const assert = require('assert');
const { detectDocType } = require('./docType');

const resumeText = `JOHN DOE\njohn@example.com | (555) 123-4567\n\nSUMMARY OF QUALIFICATIONS\nSkilled engineer.\n\nEDUCATION\nBS Computer Science`; 

const nonResume = `W-9 Form\nRequest for Taxpayer Identification Number`;

test('detects resume documents', () => {
  const res = detectDocType(resumeText);
  assert.equal(res.type, 'resume');
  assert.ok(res.confidence >= 0.8);
});

test('non-resume text has low confidence', () => {
  const res = detectDocType(nonResume);
  assert.notEqual(res.type, 'resume');
  assert.ok(res.confidence < 0.5);
});
