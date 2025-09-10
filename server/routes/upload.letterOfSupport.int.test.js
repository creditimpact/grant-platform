const { test } = require('node:test');
const assert = require('assert');
process.env.SKIP_DB = 'true';
process.env.AI_ANALYZER_URL = 'http://fake-analyzer';
process.env.ELIGIBILITY_ENGINE_URL = 'http://fake-eligibility';
process.env.enableLettersOfSupportParsing = 'true';

const express = require('express');
const { resetStore } = require('../utils/pipelineStore');

const filler = 'John Doe has been an asset to our community and organization, providing support and dedication. '.repeat(20);
const formalLetter = `Letter of Support\n\nDear Grant Committee,\n${filler}\nSincerely,\nJane Smith\nDirector, City Org\n555-123-4567\njane@city.org`;
const informalLetter = `Dear Review Team,\nI am pleased to recommend John Doe for your program. ${filler}\nBest regards,\nSam Roe\nCEO, Example Inc.\n555-555-5555\nsam@example.com`;

test('upload flow extracts support letter', async (t) => {
  global.pipelineFetch = async (url, opts) => {
    if (url.includes('fake-analyzer')) {
      return {
        ok: true,
        json: async () => ({ ocrText: formalLetter, text: formalLetter, fields_clean: { existing: { value: 1 } } }),
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
  form.append('file', new Blob(['dummy'], { type: 'application/pdf' }), 'letter.pdf');

  const res = await fetch(`http://localhost:${port}/files/upload`, {
    method: 'POST',
    body: form,
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.analyzerFields.team_documents.letters[0].doc_type, 'letter_of_support');
  assert.equal(body.analyzerFields.existing.value, 1);
  resetStore();
  delete global.pipelineFetch;
});

test('upload flow extracts informal recommendation letter', async (t) => {
  global.pipelineFetch = async (url, opts) => {
    if (url.includes('fake-analyzer')) {
      return {
        ok: true,
        json: async () => ({ ocrText: informalLetter, text: informalLetter, fields_clean: {} }),
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
  form.append('file', new Blob(['dummy'], { type: 'application/pdf' }), 'letter2.pdf');

  const res = await fetch(`http://localhost:${port}/files/upload`, {
    method: 'POST',
    body: form,
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.analyzerFields.team_documents.letters[0].doc_type, 'letter_of_support');
  resetStore();
  delete global.pipelineFetch;
});
