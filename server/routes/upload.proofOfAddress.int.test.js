const { test } = require('node:test');
const assert = require('assert');
process.env.SKIP_DB = 'true';
process.env.AI_ANALYZER_URL = 'http://fake-analyzer';
process.env.ELIGIBILITY_ENGINE_URL = 'http://fake-eligibility';

const express = require('express');
const { resetStore } = require('../utils/pipelineStore');

const utilText = `City of Springfield Water\nStatement Date: August 7, 2025\nService Address: 123 Main St Apt 4B, Springfield, IL 62701\nAccount Number: ****8921`;

test('upload flow extracts proof of address', async (t) => {
  global.pipelineFetch = async (url) => {
    if (url.includes('fake-analyzer')) {
      return {
        ok: true,
        json: async () => ({ ocrText: utilText, text: utilText, fields_clean: { existing: { value: 1 } } }),
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
  form.append('file', new Blob(['dummy'], { type: 'application/pdf' }), 'util.pdf');

  const res = await fetch(`http://localhost:${port}/files/upload`, {
    method: 'POST',
    body: form,
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.analyzerFields.identity.address_proofs[0].doc_type, 'proof_of_address');
  assert.equal(body.analyzerFields.identity.address_proofs[0].address.line1, '123 Main St Apt 4B');
  assert.equal(body.analyzerFields.existing.value, 1);
  resetStore();
  delete global.pipelineFetch;
});
