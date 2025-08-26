const request = require('supertest');
process.env.SKIP_DB = 'true';
const app = require('../index');
const { createCase, updateCase, resetStore, getCase } = require('../utils/pipelineStore');
const logger = require('../utils/logger');

describe('eligibility report endpoints', () => {
  beforeEach(() => {
    process.env.SKIP_DB = 'true';
    resetStore();
    global.fetch = jest.fn();
    logger.logs.length = 0;
  });

  test('filters unsupported forms and maps known aliases', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: { a: 1 } } });
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { program: 'p1', requiredForms: ['941-X'], missing_fields: ['m1'] },
          { program: 'p2', requiredForms: ['424A'], missing_fields: ['m2'] },
        ],
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ filled_form: {} }),
      });
    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: { b: 2 } });
    expect(res.status).toBe(200);
    expect(res.body.eligibility.results).toHaveLength(2);
    expect(res.body.eligibility.requiredForms).toEqual(['form_424A']);
    expect(global.fetch.mock.calls.length).toBe(2); // engine + one valid form
    const warnLog = logger.logs.find((l) => l.message === 'unsupported_form');
    expect(warnLog).toBeDefined();
    expect(warnLog.formId).toBe('941-X');
  });

  test('drops unsupported forms entirely', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: { a: 1 } } });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ program: 'p1', requiredForms: ['941-X'] }],
    });
    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId });
    expect(res.status).toBe(200);
    expect(res.body.eligibility.requiredForms).toEqual([]);
    expect(global.fetch.mock.calls.length).toBe(1); // only engine called
    const warnLog = logger.logs.find((l) => l.message === 'unsupported_form');
    expect(warnLog).toBeDefined();
    expect(res.body.generatedForms).toHaveLength(0);
  });

  test('maps envelope-level forms and filters unsupported', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: { a: 1 } } });
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { program: 'p1', requiredForms: ['941-X'], missing_fields: [] },
          ],
          requiredForms: ['SF-424'],
        }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ filled_form: {} }),
      });
    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: {} });
    expect(res.status).toBe(200);
    expect(res.body.eligibility.results).toHaveLength(1);
    expect(res.body.eligibility.requiredForms).toEqual(['form_sf424']);
    const warnLog = logger.logs.find((l) => l.message === 'unsupported_form');
    expect(warnLog).toBeDefined();
  });

  test('generates forms after eligibility-report', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: { a: 1 } } });
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { program: 'p1', requiredForms: ['424A'], missing_fields: [] },
          ],
        }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ filled_form: { some: 'data' } }),
      });
    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId });
    expect(res.status).toBe(200);
    expect(res.body.generatedForms).toHaveLength(1);
    expect(res.body.generatedForms[0].formId).toBe('form_424A');
    expect(res.body.generatedForms[0].name).toBeTruthy();
    expect(res.body.generatedForms[0].url).toBeTruthy();
    const stored = await getCase('dev-user', caseId);
    expect(stored.generatedForms).toHaveLength(1);
    expect(stored.generatedForms[0].formId).toBe('form_424A');
    expect(stored.generatedForms[0].name).toBeTruthy();
    expect(stored.generatedForms[0].url).toBeTruthy();
  });

  test('continues when a form-fill fails', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: { a: 1 } } });
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiredForms: ['424A', 'SF-424'], results: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ filled_form: { x: 1 } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'bad',
      });
    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId });
    expect(res.status).toBe(200);
    expect(res.body.generatedForms).toHaveLength(1);
    const errorLog = logger.logs.find((l) => l.message === 'form_fill_failed');
    expect(errorLog).toBeDefined();
  });

  test('GET returns latest eligibility', async () => {
    const caseId = await createCase('dev-user');
    const eligibility = {
      results: [{ program: 'p', requiredForms: ['form_424A'], missing_fields: ['m'] }],
      requiredForms: ['form_424A'],
      lastUpdated: new Date().toISOString(),
    };
    await updateCase(caseId, { eligibility });
    const res = await request(app)
      .get('/api/eligibility-report')
      .query({ caseId });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.eligibility.requiredForms)).toBe(true);
    expect(res.body.eligibility.requiredForms).toEqual(['form_424A']);
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

  test('returns 502 when engine is unreachable', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: {} } });
    global.fetch.mockRejectedValueOnce(new Error('network down'));
    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({
      message: 'Eligibility engine unreachable',
    });
    const logEntry = logger.logs.find(
      (l) => l.message === 'eligibility_engine_unreachable'
    );
    expect(logEntry).toBeDefined();
    expect(logEntry.requestId).toBe(res.headers['x-request-id']);
  });
});
