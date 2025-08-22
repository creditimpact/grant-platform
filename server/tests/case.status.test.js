const request = require('supertest');
process.env.SKIP_DB = 'true';
const app = require('../index');
const { createCase, updateCase, resetStore } = require('../utils/pipelineStore');

describe('case status endpoint', () => {
  beforeEach(() => {
    process.env.SKIP_DB = 'true';
    resetStore();
  });

  test('returns questionnaire and analyzer fields', async () => {
    const caseId = await createCase('dev-user');
    const now = new Date().toISOString();
    await updateCase(caseId, {
      analyzer: { fields: { ein: '11-1111111' }, lastUpdated: now },
      questionnaire: { data: { foo: 'bar' }, lastUpdated: now },
      eligibility: { results: [{ missing_fields: ['a'] }], lastUpdated: now },
    });
    const res = await request(app)
      .get('/api/case/status')
      .query({ caseId });
    expect(res.status).toBe(200);
    expect(res.body.analyzerFields).toEqual({ ein: '11-1111111' });
    expect(res.body.questionnaire.data).toEqual({ foo: 'bar' });
    expect(res.body.questionnaire.missingFieldsHint).toEqual(['a']);
  });
});
