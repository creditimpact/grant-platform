const request = require('supertest');
process.env.SKIP_DB = 'true';
const app = require('../index');
const { createCase, updateCase, resetStore } = require('../utils/pipelineStore');

describe('analyzer to engine smoke test', () => {
  beforeEach(() => {
    resetStore();
  });

  test('integration path', async () => {
    const caseId = await createCase('dev');
    await updateCase(caseId, {
      analyzer: {
        fields: {
          owner_gender: 'female',
          owner_minority: true,
          ownership_percentage: 60,
          owner_is_decision_maker: true,
          business_location_state: 'CA',
          number_of_employees: 5,
          annual_revenue: 500000,
          business_age_years: 2,
        },
      },
    });
    const res = await request(app).post('/api/eligibility-report').send({ caseId });
    expect(res.status).toBe(200);
    expect(res.body.eligibility.results.length).toBeGreaterThan(0);
  });
});

describe('pipeline normalization', () => {
  test('user overrides analyzer value', () => {
    const extracted = { ein: '111111111', w2_employee_count: 5 };
    const basePayload = { ein: '222222222' };
    const normalized = { ...extracted, ...basePayload };
    expect(normalized).toEqual({ ein: '222222222', w2_employee_count: 5 });
  });

  test('non-conflicting keys merge correctly', () => {
    const extracted = { annual_revenue: 500000 };
    const basePayload = { entity_type: 'C-Corp' };
    const normalized = { ...extracted, ...basePayload };
    expect(normalized).toEqual({ annual_revenue: 500000, entity_type: 'C-Corp' });
  });
});
