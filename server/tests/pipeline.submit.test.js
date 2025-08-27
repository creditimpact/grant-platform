const request = require('supertest');
const path = require('path');
const fs = require('fs');
process.env.SKIP_DB = 'true';

const app = require('../index');
const { resetStore } = require('../utils/pipelineStore');

describe('pipeline submit-case', () => {
  const tmpDir = path.join(__dirname, 'tmp-pipeline');
  beforeEach(() => {
    process.env.DRAFTS_DIR = tmpDir;
    resetStore();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('generates PDFs in tmpDir', async () => {
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

    let req = request(app)
      .post('/api/submit-case')
      .field('businessName', 'Biz')
      .field('email', 'a@b.com')
      .field('phone', '1234567');
    for (const [k, v] of Object.entries(payload)) {
      req = req.field(k, String(v));
    }
    const res = await req;

    expect(res.status).toBe(200);
    expect(res.body.generatedForms.length).toBeGreaterThan(0);
    const formId = res.body.generatedForms[0].formId;
    const filePath = path.join(tmpDir, res.body.caseId, `${formId}.pdf`);
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
