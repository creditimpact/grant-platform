const request = require('supertest');
const path = require('path');
const fs = require('fs');
process.env.SKIP_DB = 'true';

const app = require('../index');
const { createCase, resetStore } = require('../utils/pipelineStore');

describe('eligibility report endpoints', () => {
  const tmpDir = path.join(__dirname, 'tmp-eligibility');
  beforeEach(async () => {
    process.env.DRAFTS_DIR = tmpDir;
    resetStore();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('calls real eligibility engine and renders PDFs', async () => {
    const caseId = await createCase('dev-user');
    const payload = {
      owner_gender: 'female',
      owner_minority: true,
      ownership_percentage: 60,
      owner_is_decision_maker: true,
      business_location_state: 'CA',
      number_of_employees: 5,
      annual_revenue: 500000,
      business_age_years: 2,
    };

    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.eligibility.results)).toBe(true);
    expect(res.body.eligibility.results.length).toBeGreaterThan(0);
    expect(res.body.generatedForms.length).toBeGreaterThan(0);
    res.body.generatedForms.forEach((g) => {
      const filePath = path.join(tmpDir, caseId, `${g.formId}.pdf`);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});
