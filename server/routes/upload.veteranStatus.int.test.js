const { test } = require('node:test');
const assert = require('assert');
process.env.SKIP_DB = 'true';
process.env.AI_ANALYZER_URL = 'http://fake-analyzer';
process.env.ELIGIBILITY_ENGINE_URL = 'http://fake-eligibility';
process.env.enableVeteranStatusParsing = 'true';

const express = require('express');
const { resetStore } = require('../utils/pipelineStore');

const certText = `DD Form 214\nCertificate of Release or Discharge from Active Duty\nDepartment of Defense\nName: John Doe\nService Branch: Army\nDate Entered Active Duty: 01/01/2000\nSeparation Date: 01/01/2004\nDischarge: Honorable`;

const appText = `Application for Certified Copy of Military Discharge\nDepartment of Defense\nApplicant Name: Jane Smith\nRelationship to Veteran: Spouse\nEligibility: I am the spouse of the veteran.\nNotary Public: Alan Agent\nState of California\nMy commission expires 12/31/2025`;

test('upload flow extracts veteran certificate', async (t) => {
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
  form.append('file', new Blob(['dummy'], { type: 'application/pdf' }), 'dd214.pdf');

  const res = await fetch(`http://localhost:${port}/files/upload`, { method: 'POST', body: form });
  assert.equal(res.status, 200);
  const body = await res.json();
    assert.equal(body.analyzerFields.identity.veteran_status[0].veteran_name, 'John Doe');
    assert.equal(body.analyzerFields.identity.veteran_status[0].form_type, 'dd214_certificate');
    assert.equal(body.analyzerFields.existing.value, 1);
    resetStore();
    delete global.pipelineFetch;
    delete require.cache[require.resolve('./files')];
  });

test('upload flow extracts veteran application', async (t) => {
  global.pipelineFetch = async (url) => {
    if (url.includes('fake-analyzer')) {
      return {
        ok: true,
        json: async () => ({ ocrText: appText, text: appText, fields_clean: { existing: { value: 1 } } }),
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
  form.append('file', new Blob(['dummy'], { type: 'application/pdf' }), 'dd214app.pdf');

  const res = await fetch(`http://localhost:${port}/files/upload`, { method: 'POST', body: form });
  assert.equal(res.status, 200);
  const body = await res.json();
    assert.equal(body.analyzerFields.identity.veteran_status[0].applicant_name, 'Jane Smith');
    assert.equal(body.analyzerFields.identity.veteran_status[0].form_type, 'dd214_application');
    resetStore();
    delete global.pipelineFetch;
    delete require.cache[require.resolve('./files')];
  });
