const request = require('supertest');
const path = require('path');
const fs = require('fs');
process.env.SKIP_DB = 'true';

const app = require('../index');
const { createCase, resetStore } = require('../utils/pipelineStore');

describe('eligibility report endpoints', () => {
  const tmpDir = path.join(__dirname, 'tmp-eligibility');
  async function waitForDb() {
    if (process.env.SKIP_DB === 'true') return;
    const mongoose = require('mongoose');
    const start = Date.now();
    while (mongoose.connection.readyState !== 1 && Date.now() - start < 15000) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200));
    }
    // eslint-disable-next-line no-console
    console.log('[test:eligibility.report] mongoose.readyState=', mongoose.connection.readyState);
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

  test('calls real eligibility engine and renders PDFs', async () => {
    const { URL } = require('url');
    const caseId = await createCase('dev-user');
    const payload = {
      // Eligibility traits
      owner_gender: 'female',
      owner_minority: true,
      ownership_percentage: 60,
      owner_is_decision_maker: true,
      business_location_state: 'CA',
      number_of_employees: 5,
      annual_revenue: 500000,
      business_age_years: 2,
      // SF-424 minimal inputs that map to required outputs
      legalBusinessName: 'ACME Co',
      ein: '123456789',
      projectTitle: 'Test Project',
      projectStart: '01/01/2024',
      projectEnd: '02/01/2024',
      fundingRequest: 10000,
      authorizedRepSameAsOwner: true,
      ownerFirstName: 'Jane',
      ownerLastName: 'Doe',
      ownerTitle: 'CEO',
      physicalAddress: { street: '1 Main', city: 'Town', state: 'CA', zip: '12345' },
      // Duplicate snake_case for engine-side expectations
      applicant_legal_name: 'ACME Co',
      descriptive_title: 'Test Project',
      project_start_date: '01/01/2024',
      project_end_date: '02/01/2024',
      authorized_rep_name: 'Jane Doe',
      authorized_rep_title: 'CEO',
      funding_total: 10000,
    };

    const engineUrl = new URL(
      process.env.ELIGIBILITY_ENGINE_PATH || '/check',
      process.env.ELIGIBILITY_ENGINE_URL || 'http://localhost:4001'
    ).toString();
    // eslint-disable-next-line no-console
    console.log('[test:eligibility.report] engineUrl=', engineUrl, 'payloadKeys=', Object.keys(payload));

    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload })
      .timeout({ response: 20000, deadline: 30000 });
    // eslint-disable-next-line no-console
    console.log('[test:eligibility.report] status=', res.status);
    if (res.status !== 200) {
      throw new Error(`eligibility-report returned ${res.status}: ${res.text || ''}`);
    }

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.eligibility?.results)).toBe(true);
    if (!Array.isArray(res.body.generatedForms)) {
      // eslint-disable-next-line no-console
      console.log('[test:eligibility.report] body when missing generatedForms=', res.body);
      throw new Error('Expected generatedForms array in response body');
    }
    if (res.body.generatedForms.length === 0) {
      // eslint-disable-next-line no-console
      console.log('[test:eligibility.report] body when generatedForms empty=', res.body);
      const missing = (res.body.incompleteForms || []).flatMap((f) => f.missingFields || []);
      throw new Error(`Expected at least one generated form. Missing fields: ${missing.join(', ')}`);
    }
    res.body.generatedForms.forEach((g) => {
      const filePath = path.join(tmpDir, caseId, `${g.formId}.pdf`);
      expect(fs.existsSync(filePath)).toBe(true);
    });
    // Auto-filled in test mode via mapper
    expect(res.body.generatedForms[0]?.data?.authorized_rep_date_signed).toBeTruthy();
    // descriptive_title should be present
    expect(res.body.generatedForms[0]?.data?.descriptive_title).toBeTruthy();
  });

  test('SF-424 uses fallback descriptive_title in test mode when missing', async () => {
    const { URL } = require('url');
    const caseId = await createCase('dev-user');
    // Provide all required fields except projectTitle/descriptive_title
    const payload = {
      owner_gender: 'female',
      owner_minority: true,
      ownership_percentage: 60,
      owner_is_decision_maker: true,
      business_location_state: 'CA',
      number_of_employees: 5,
      annual_revenue: 500000,
      business_age_years: 2,
      legalBusinessName: 'ACME Co',
      ein: '123456789',
      projectStart: '01/01/2024',
      projectEnd: '02/01/2024',
      fundingRequest: 10000,
      authorizedRepSameAsOwner: true,
      ownerFirstName: 'Jane',
      ownerLastName: 'Doe',
      ownerTitle: 'CEO',
    };

    const engineUrl = new URL(
      process.env.ELIGIBILITY_ENGINE_PATH || '/check',
      process.env.ELIGIBILITY_ENGINE_URL || 'http://localhost:4001'
    ).toString();
    console.log('[test:eligibility.report:fallback] engineUrl=', engineUrl, 'payloadKeys=', Object.keys(payload));

    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload })
      .timeout({ response: 20000, deadline: 30000 });
    console.log('[test:eligibility.report:fallback] status=', res.status);
    if (res.status !== 200) {
      throw new Error(`eligibility-report returned ${res.status}: ${res.text || ''}`);
    }

    expect(Array.isArray(res.body.generatedForms)).toBe(true);
    expect(res.body.generatedForms.length).toBeGreaterThan(0);
    expect(res.body.generatedForms[0]?.data?.descriptive_title).toBe('Test Project Title');
  });
});
