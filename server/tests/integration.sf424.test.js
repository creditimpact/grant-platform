const request = require('supertest');
const path = require('path');
const fs = require('fs');
process.env.SKIP_DB = 'true';
process.env.PROCESS_TEST_MODE = 'true';

const app = require('../index');
const { resetStore } = require('../utils/pipelineStore');

describe('eligibility report integration', () => {
  const tmpDir = path.join(__dirname, 'tmp-sf424');
  beforeEach(() => {
    process.env.DRAFTS_DIR = tmpDir;
    resetStore();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('submitting questionnaire produces draft PDF', async () => {
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

    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ payload });

    expect(res.status).toBe(200);
    expect(res.body.generatedForms[0].url).toBeTruthy();
    const caseId = res.body.caseId;
    const formId = res.body.generatedForms[0].formId;
    const filePath = path.join(tmpDir, caseId, `${formId}.pdf`);
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
