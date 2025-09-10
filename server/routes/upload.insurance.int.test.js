const { test } = require('node:test');
const assert = require('assert');
process.env.SKIP_DB = 'true';
process.env.AI_ANALYZER_URL = 'http://fake-analyzer';
process.env.ELIGIBILITY_ENGINE_URL = 'http://fake-eligibility';

const express = require('express');
const { resetStore } = require('../utils/pipelineStore');

const certText = `CERTIFICATE OF LIABILITY INSURANCE\nACORD 25\nProducer: Alpha Insurance Agency\nInsured: My Bakery LLC\nINSR LTR A: Great Insurer NAIC#12345\nCoverages\nGeneral Liability Policy Number GL123 Eff Date 01/01/2024 Exp Date 01/01/2025 Each Occurrence $1,000,000 Aggregate $2,000,000\nCertificate Holder: City of Springfield`;

test('upload flow extracts insurance certificate', async (t) => {
  global.pipelineFetch = async (url) => {
    if (url.includes('fake-analyzer')) {
      return {
        ok: true,
        json: async () => ({ ocrText: certText, text: certText, fields_clean: { existing: { value: 1 } } }),
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
  form.append('file', new Blob(['dummy'], { type: 'application/pdf' }), 'cert.pdf');

  const res = await fetch(`http://localhost:${port}/files/upload`, {
    method: 'POST',
    body: form,
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.analyzerFields.compliance.insurance[0].doc_type, 'insurance_certificate');
  assert.equal(body.analyzerFields.compliance.insurance[0].insured.name, 'My Bakery Llc');
  assert.equal(body.analyzerFields.existing.value, 1);
  resetStore();
  delete global.pipelineFetch;
});
