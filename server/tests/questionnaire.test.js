const request = require('supertest');
process.env.SKIP_DB = 'true';
global.fetch = undefined;
const app = require('../index');
const { createCase, updateCase, getCase, resetStore } = require('../utils/pipelineStore');

describe('questionnaire endpoints', () => {
  beforeEach(() => {
    process.env.SKIP_DB = 'true';
    resetStore();
  });

  test('POST saves questionnaire and merges missing fields', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: { existing: 'keep', empty: '' } } });
    const res = await request(app)
      .post('/api/questionnaire')
      .send({
        caseId,
        answers: { existing: 'new', empty: 'filled', newField: 'val' },
      });
    expect(res.status).toBe(200);
    const c = await getCase('dev-user', caseId);
    expect(c.analyzer.fields).toEqual({
      existing: 'keep',
      empty: 'filled',
      newField: 'val',
    });
    expect(c.questionnaire.data.newField).toBe('val');
  });

  test('GET returns questionnaire with missingFieldsHint', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, {
      questionnaire: { data: { foo: 'bar' }, lastUpdated: new Date().toISOString() },
      eligibility: {
        results: [
          { missing_fields: ['a', 'b'] },
          { missing_fields: ['b', 'c'] },
        ],
        requiredForms: [],
        lastUpdated: new Date().toISOString(),
      },
    });
    const res = await request(app)
      .get('/api/questionnaire')
      .query({ caseId });
    expect(res.status).toBe(200);
    expect(res.body.questionnaire.missingFieldsHint.sort()).toEqual(['a', 'b', 'c']);
  });
});
