const request = require('supertest');
const path = require('path');
const fs = require('fs');
process.env.SKIP_DB = 'true';
process.env.PROCESS_TEST_MODE = 'true';

const app = require('../index');
const { resetStore } = require('../utils/pipelineStore');

describe('eligibility report integration', () => {
  const tmpDir = path.join(__dirname, 'tmp-sf424');
  async function waitForDb() {
    if (process.env.SKIP_DB === 'true') return;
    const mongoose = require('mongoose');
    const start = Date.now();
    while (mongoose.connection.readyState !== 1 && Date.now() - start < 15000) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200));
    }
    // eslint-disable-next-line no-console
    console.log('[test:integration.sf424] mongoose.readyState=', mongoose.connection.readyState);
  }

  beforeEach(async () => {
    process.env.DRAFTS_DIR = tmpDir;
    await waitForDb();
    resetStore();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
  afterAll(() => {
    // Best-effort cleanup to avoid open handles
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    try { resetStore(); } catch {}
  });

  test('submitting questionnaire produces draft PDF', async () => {
    const { URL } = require('url');
    const payload = {
      legalBusinessName: 'ACME',
      ein: '11',
      projectTitle: 'Proj',
      projectStart: '2024-01-01',
      projectEnd: '2024-02-01',
      fundingRequest: '1000',
      authorizedRepSameAsOwner: true,
      ownerFirstName: 'Jane',
      ownerLastName: 'Doe',
      ownerTitle: 'CEO',
      physicalAddress: { street: '1 Main', city: 'Town', state: 'CA', zip: '12345' },
      ownerGender: 'female',
      ownerMinority: true,
      ownershipPercentage: 60,
      ownerIsDecisionMaker: true,
      numberOfEmployees: 5,
      annualRevenue: 500000,
      businessAgeYears: 2,
      businessLocationState: 'CA',
    };

    const engineUrl = new URL(
      process.env.ELIGIBILITY_ENGINE_PATH || '/check',
      process.env.ELIGIBILITY_ENGINE_URL || 'http://localhost:4001'
    ).toString();
    // eslint-disable-next-line no-console
    console.log('[test:integration.sf424] engineUrl=', engineUrl, 'payloadKeys=', Object.keys(payload));

    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ payload })
      .timeout({ response: 20000, deadline: 30000 });
    // eslint-disable-next-line no-console
    console.log('[test:integration.sf424] status=', res.status);
    if (res.status !== 200) {
      throw new Error(`eligibility-report returned ${res.status}: ${res.text || ''}`);
    }

    expect(res.status).toBe(200);
    if (!Array.isArray(res.body.generatedForms)) {
      // eslint-disable-next-line no-console
      console.log('[test:integration.sf424] body when missing generatedForms=', res.body);
      throw new Error('Expected generatedForms array in response body');
    }
    if (res.body.generatedForms.length === 0) {
      // eslint-disable-next-line no-console
      console.log('[test:integration.sf424] body when generatedForms empty=', res.body);
      throw new Error('Expected at least one generated form');
    }
    expect(res.body.generatedForms[0].url).toBeTruthy();
    const caseId = res.body.caseId;
    const formId = res.body.generatedForms[0].formId;
    const filePath = path.join(tmpDir, caseId, `${formId}.pdf`);
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
