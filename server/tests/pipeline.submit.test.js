const request = require('supertest');
const path = require('path');
const fs = require('fs');
process.env.SKIP_DB = 'true';

const app = require('../index');
const { resetStore } = require('../utils/pipelineStore');

describe('pipeline submit-case', () => {
  const tmpDir = path.join(__dirname, 'tmp-pipeline');
  async function waitForDb() {
    if (process.env.SKIP_DB === 'true') return;
    const mongoose = require('mongoose');
    const start = Date.now();
    while (mongoose.connection.readyState !== 1 && Date.now() - start < 15000) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200));
    }
    // eslint-disable-next-line no-console
    console.log('[test:pipeline.submit] mongoose.readyState=', mongoose.connection.readyState);
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

  test('generates PDFs in tmpDir', async () => {
    const { URL } = require('url');
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
      // Use MM/DD/YYYY format per SF-424 mapping expectations
      projectStart: '01/01/2024',
      projectEnd: '02/01/2024',
      // Send fundingRequest as numeric (form-data will coerce appropriately)
      fundingRequest: 10000,
      authorizedRepSameAsOwner: true,
      ownerFirstName: 'Jane',
      ownerLastName: 'Doe',
      ownerTitle: 'CEO',
      // Duplicate in snake_case for engine-side expectations
      applicant_legal_name: 'ACME Co',
      descriptive_title: 'Test Project',
      project_start_date: '01/01/2024',
      project_end_date: '02/01/2024',
      authorized_rep_name: 'Jane Doe',
      authorized_rep_title: 'CEO',
      funding_total: 10000,
      // Optional: try to supply address in flattened form-data keys
      'physicalAddress.street': '1 Main',
      'physicalAddress.city': 'Town',
      'physicalAddress.state': 'CA',
      'physicalAddress.zip': '12345',
    };

    const engineUrl = new URL(
      process.env.ELIGIBILITY_ENGINE_PATH || '/check',
      process.env.ELIGIBILITY_ENGINE_URL || 'http://localhost:4001'
    ).toString();
    // Helpful debug for flakiness
    // Note: pipeline route triggers analyzer + eligibility under the hood
    // so we log engine URL and payload keys
    // eslint-disable-next-line no-console
    console.log('[test:pipeline.submit] engineUrl=', engineUrl, 'payloadKeys=', Object.keys(payload));

    let req = request(app)
      .post('/api/submit-case')
      .field('businessName', 'Biz')
      .field('email', 'a@b.com')
      .field('phone', '1234567')
      // Fail fast if upstream hangs
      .timeout({ response: 20000, deadline: 30000 });
    for (const [k, v] of Object.entries(payload)) {
      req = req.field(k, v);
    }
    const res = await req;
    // eslint-disable-next-line no-console
    console.log('[test:pipeline.submit] status=', res.status);
    if (res.status !== 200) {
      throw new Error(`submit-case returned ${res.status}: ${res.text || ''}`);
    }

    expect(res.status).toBe(200);
    if (!Array.isArray(res.body.generatedForms)) {
      // eslint-disable-next-line no-console
      console.log('[test:pipeline.submit] body when missing generatedForms=', res.body);
      throw new Error('Expected generatedForms array in response body');
    }
    if (res.body.generatedForms.length === 0) {
      // eslint-disable-next-line no-console
      console.log('[test:pipeline.submit] body when generatedForms empty=', res.body);
      // eslint-disable-next-line no-console
      console.log('[test:pipeline.submit] incompleteForms=', res.body.incompleteForms);
      const missing = (res.body.incompleteForms || []).flatMap((f) => f.missingFields || []);
      throw new Error(`Expected at least one generated form. Missing fields: ${missing.join(', ')}`);
    }
    const formId = res.body.generatedForms[0].formId;
    const filePath = path.join(tmpDir, res.body.caseId, `${formId}.pdf`);
    expect(fs.existsSync(filePath)).toBe(true);
    // Auto-filled in test mode via mapper
    expect(res.body.generatedForms[0].data?.authorized_rep_date_signed).toBeTruthy();
    // descriptive_title should be populated (from projectTitle or direct)
    expect(res.body.generatedForms[0].data?.descriptive_title).toBeTruthy();
  });
});
