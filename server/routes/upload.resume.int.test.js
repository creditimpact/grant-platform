const { test } = require('node:test');
const assert = require('assert');
process.env.SKIP_DB = 'true';
process.env.AI_ANALYZER_URL = 'http://fake-analyzer';
process.env.ELIGIBILITY_ENGINE_URL = 'http://fake-eligibility';

const express = require('express');
const { resetStore } = require('../utils/pipelineStore');

const resumeText = `JOHN DOE\njohn@example.com | (555) 123-4567\n\nSUMMARY OF QUALIFICATIONS\nSkilled engineer.\n\nEDUCATION\nBS Computer Science`;

test('upload flow extracts resume', async (t) => {
  global.pipelineFetch = async (url, opts) => {
    if (url.includes('fake-analyzer')) {
      return {
        ok: true,
        json: async () => ({ ocrText: resumeText, text: resumeText, fields_clean: { existing: { value: 1 } } }),
        headers: { get: () => 'application/json' },
      };
    }
    if (url.includes('fake-eligibility')) {
      return {
        ok: true,
        json: async () => ({ results: [] }),
        headers: { get: () => 'application/json' },
      };
    }
    throw new Error('unexpected fetch ' + url);
  };

  const filesRouter = require('./files');
  const app = express();
  app.use('/', filesRouter);
  const server = app.listen(0);
  t.after(() => server.close());

  const port = server.address().port;
  const form = new FormData();
  form.append('file', new Blob(['dummy'], { type: 'application/pdf' }), 'resume.pdf');

  const res = await fetch(`http://localhost:${port}/files/upload`, {
    method: 'POST',
    body: form,
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.analyzerFields.team_documents.resumes[0].doc_type, 'resume');
  assert.equal(body.analyzerFields.existing.value, 1);
  resetStore();
  delete global.pipelineFetch;
});
