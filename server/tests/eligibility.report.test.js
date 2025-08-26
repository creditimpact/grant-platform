const request = require('supertest');
process.env.SKIP_DB = 'true';
const app = require('../index');
const { createCase, updateCase, resetStore } = require('../utils/pipelineStore');

describe('eligibility report endpoints', () => {
  beforeEach(() => {
    process.env.SKIP_DB = 'true';
    resetStore();
    global.fetch = jest.fn();
  });

  test('POST aggregates required forms from array response', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: { a: 1 } } });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { program: 'p1', requiredForms: ['941-X'], missing_fields: ['m1'] },
        { program: 'p2', requiredForms: ['424A'], missing_fields: ['m2'] },
      ],
    });
    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: { b: 2 } });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.eligibility.results)).toBe(true);
    expect(res.body.eligibility.results).toHaveLength(2);
    expect(Array.isArray(res.body.eligibility.requiredForms)).toBe(true);
    expect(res.body.eligibility.requiredForms).toEqual(
      expect.arrayContaining(['941-X', '424A'])
    );

    const statusRes = await request(app).get(`/api/status/${caseId}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.analyzerFields).toBeDefined();
    expect(Array.isArray(statusRes.body.eligibility.results)).toBe(true);
  });

  test('POST aggregates required forms from envelope response', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: { a: 1 } } });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { program: 'p1', requiredForms: ['941-X'], missing_fields: [] },
        ],
        requiredForms: ['SF-424'],
      }),
    });
    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: {} });
    expect(res.status).toBe(200);
    expect(res.body.eligibility.results).toHaveLength(1);
    expect(res.body.eligibility.requiredForms).toEqual(
      expect.arrayContaining(['941-X', 'SF-424'])
    );
  });

  test('GET returns latest eligibility', async () => {
    const caseId = await createCase('dev-user');
    const eligibility = {
      results: [{ program: 'p', requiredForms: ['f1'], missing_fields: ['m'] }],
      requiredForms: ['f1'],
      lastUpdated: new Date().toISOString(),
    };
    await updateCase(caseId, { eligibility });
    const res = await request(app)
      .get('/api/eligibility-report')
      .query({ caseId });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.eligibility.requiredForms)).toBe(true);
    expect(res.body.eligibility.requiredForms).toEqual(['f1']);
    expect(res.body.missingFieldsSummary).toEqual(['m']);
    expect(res.body.analyzerFields).toBeDefined();
  });

  test('engine error propagates with details', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: {} } });
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({ error: 'bad' }),
    });
    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId });
    expect(res.status).toBe(502);
    expect(res.body.message).toBe('Eligibility engine error');
    expect(res.body.details).toBeDefined();
  });
});
