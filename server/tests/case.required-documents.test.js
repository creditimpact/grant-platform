const request = require('supertest');
process.env.SKIP_DB = 'true';
const app = require('../index');
const { createCase, updateCase, resetStore } = require('../utils/pipelineStore');

describe('GET /api/case/required-documents', () => {
  beforeEach(() => {
    resetStore();
  });

  test('returns required documents for case', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, {
      questionnaire: { data: { employees: 5, ownerVeteran: true } },
    });
    const res = await request(app).get(
      `/api/case/required-documents?caseId=${caseId}`
    );
    expect(res.status).toBe(200);
    const docs = res.body.required;
    expect(docs).toContain('Tax Returns (last 2–3 years)');
    expect(docs).toContain('Quarterly revenue statements (2020–2021)');
    expect(docs).toContain('DD214 (Proof of Veteran Status)');
  });

  test('404 when case not found', async () => {
    const res = await request(app).get(
      '/api/case/required-documents?caseId=missing'
    );
    expect(res.status).toBe(404);
  });
});
