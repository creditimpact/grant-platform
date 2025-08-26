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

  test('POST saves questionnaire and overrides existing analyzer fields', async () => {
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
      existing: 'new',
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

describe('questionnaire merge precedence', () => {
  test('user input overrides analyzer value', () => {
    const existingFields = { ein: '111111111', w2_employee_count: 3 };
    const payload = { ein: '222222222' };
    const merged = { ...existingFields, ...payload };
    expect(merged).toEqual({ ein: '222222222', w2_employee_count: 3 });
  });

  test('non-provided keys remain from existing fields', () => {
    const existingFields = { entity_type: 'LLC', year_founded: 2019 };
    const payload = { entity_type: 'C-Corp' };
    const merged = { ...existingFields, ...payload };
    expect(merged.year_founded).toBe(2019);
    expect(merged.entity_type).toBe('C-Corp');
  });

  test('multiple fields override', () => {
    const existingFields = { ein: '111111111', annual_revenue: 500000, state: 'CA' };
    const payload = { ein: '222222222', annual_revenue: 750000 };
    const merged = { ...existingFields, ...payload };
    expect(merged).toEqual({
      ein: '222222222',
      annual_revenue: 750000,
      state: 'CA',
    });
  });
});
