const { test } = require('node:test');
const assert = require('assert');
const { extractResume } = require('./resume');

const text = `JOHN DOE\n123 Main St, Springfield, IL 62701\njohn@example.com | (555) 123-4567\n\nSUMMARY OF QUALIFICATIONS\nExperienced software engineer with a passion for building applications.\n\nPROFESSIONAL EXPERIENCE\nSoftware Engineer, Acme Corp, Springfield, IL (Jan 2020 - Present)\n- Developed features\n- Improved performance\n\nEDUCATION\nBachelor of Science in Computer Science, University of Nowhere, Springfield, IL 2016\nGPA: 3.8\n\nTECHNICAL SKILLS\nJavaScript, Node.js, Leadership, Communication\n\nCERTIFICATIONS\nAWS Certified Solutions Architect\n\nRevision: June 2015`;

test('extracts core resume fields', () => {
  const res = extractResume({ text });
  assert.equal(res.full_name, 'John Doe');
  assert.equal(res.contact.email, 'john@example.com');
  assert.equal(res.contact.phone.includes('555'), true);
  assert.equal(res.contact.location.city, 'Springfield');
  assert.equal(res.summary.startsWith('Experienced software engineer'), true);
  assert.equal(res.experience[0].role_title, 'Software Engineer');
  assert.equal(res.education[0].degree, 'bachelor');
  assert.ok(res.skills.technical.includes('JavaScript'));
  assert.ok(res.skills.general.includes('Leadership'));
  assert.equal(res.certifications[0], 'AWS Certified Solutions Architect');
  assert.equal(res.last_updated, '2015-06-01');
});
