const request = require('supertest');
process.env.SKIP_DB = 'true';

jest.mock('../utils/pdfRenderer', () => require('./__mocks__/pdfRenderer.mock'));
jest.mock('../utils/formTemplates', () => require('./__mocks__/formTemplates.mock'));

const app = require('../index');
const { createCase, updateCase, resetStore, getCase } = require('../utils/pipelineStore');
const logger = require('../utils/logger');
const { makeEngineOk } = require('./__mocks__/fetch.mock');

describe('eligibility report endpoints', () => {
  beforeEach(() => {
    process.env.SKIP_DB = 'true';
    resetStore();
    global.fetch = makeEngineOk();
    logger.logs.length = 0;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('filters unsupported forms and maps known aliases', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: { a: 1 } } });
    global.fetch = makeEngineOk({
      results: [
        { program: 'p1', requiredForms: ['941-X'], missing_fields: ['m1'] },
        { program: 'p2', requiredForms: ['424A'], missing_fields: ['m2'] },
      ],
      requiredForms: ['424A'],
    });
    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: { b: 2 } });
    expect(res.status).toBe(200);
    expect(res.body.eligibility.results).toHaveLength(2);
    expect(res.body.eligibility.requiredForms).toEqual([
      'form_sf424',
      'form_424A',
    ]);
    expect(res.body.generatedForms).toHaveLength(2);
    const formIds = res.body.generatedForms.map((f) => f.formId);
    expect(formIds).toEqual(expect.arrayContaining(['form_sf424', 'form_424A']));
    const warnLog = logger.logs.find((l) => l.message === 'unsupported_form');
    expect(warnLog).toBeDefined();
    expect(warnLog.formId).toBe('941-X');
  });

  test('drops unsupported forms entirely', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: { a: 1 } } });
    global.fetch = makeEngineOk({
      results: [{ program: 'p1', requiredForms: ['941-X'] }],
      requiredForms: [],
    });
    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId });
    expect(res.status).toBe(200);
    expect(res.body.eligibility.requiredForms).toEqual(['form_sf424']);
    const warnLog = logger.logs.find((l) => l.message === 'unsupported_form');
    expect(warnLog).toBeDefined();
    expect(res.body.generatedForms).toHaveLength(1);
  });

  test('maps envelope-level forms and filters unsupported', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: { a: 1 } } });
    global.fetch = makeEngineOk({
      results: [
        { program: 'p1', requiredForms: ['941-X'], missing_fields: [] },
      ],
      requiredForms: ['SF-424'],
    });
    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: {} });
    expect(res.status).toBe(200);
    expect(res.body.eligibility.results).toHaveLength(1);
    expect(res.body.eligibility.requiredForms).toEqual(['form_sf424']);
    expect(res.body.generatedForms).toHaveLength(1);
    const warnLog = logger.logs.find((l) => l.message === 'unsupported_form');
    expect(warnLog).toBeDefined();
  });

  test('generates forms after eligibility-report', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: { a: 1 } } });
    global.fetch = makeEngineOk({
      results: [
        { program: 'p1', requiredForms: ['424A'], missing_fields: [] },
      ],
      requiredForms: [],
    });
    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId });
    expect(res.status).toBe(200);
    expect(res.body.generatedForms).toHaveLength(2);
    const ids = res.body.generatedForms.map((f) => f.formId);
    expect(ids).toEqual(expect.arrayContaining(['form_424A', 'form_sf424']));
    res.body.generatedForms.forEach((f) => {
      expect(f.name).toBeTruthy();
      expect(f.url).toBeTruthy();
    });
    const stored = await getCase('dev-user', caseId);
    expect(stored.generatedForms).toHaveLength(2);
    const storedIds = stored.generatedForms.map((f) => f.formId);
    expect(storedIds).toEqual(expect.arrayContaining(['form_424A', 'form_sf424']));
    stored.generatedForms.forEach((f) => {
      expect(f.name).toBeTruthy();
      expect(f.url).toBeTruthy();
    });
  });

  test('omits url when pdf render fails', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: { a: 1 } } });
    const pdfRenderer = require('../utils/pdfRenderer');
    const spy = jest
      .spyOn(pdfRenderer, 'renderPdf')
      .mockRejectedValueOnce(new Error('boom'));
    global.fetch = makeEngineOk({
      results: [
        { program: 'p1', requiredForms: ['424A'], missing_fields: [] },
      ],
      requiredForms: [],
    });
    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId });
    expect(res.status).toBe(200);
    expect(res.body.generatedForms).toHaveLength(2);
    expect(res.body.generatedForms.some((f) => !f.url)).toBe(true);
    const log = logger.logs.find((l) => l.message === 'pdf_render_failed');
    expect(log).toBeDefined();
    spy.mockRestore();
  });

  test('records incomplete form when required fields missing', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: { a: 1 } } });
    const formTemplates = require('../utils/formTemplates');
    formTemplates.getLatestTemplate.mockResolvedValue({
      version: 1,
      schema: { required: ['foo'], properties: { foo: { type: 'string' } } },
    });
    global.fetch = makeEngineOk({ results: [], requiredForms: ['424A'] });
    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId });
    expect(res.status).toBe(200);
    expect(res.body.generatedForms).toHaveLength(1);
    expect(res.body.generatedForms[0].formId).toBe('form_sf424');
    expect(res.body.incompleteForms).toHaveLength(1);
    expect(res.body.incompleteForms[0].missingFields).toEqual(['foo']);
    const log = logger.logs.find((l) => l.message === 'form_fill_validation_failed');
    expect(log).toBeDefined();
    formTemplates.getLatestTemplate.mockRestore();
  });

  test('continues when a form-fill fails', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: { a: 1 } } });
    global.fetch = jest
      .fn()
      .mockImplementationOnce(
        makeEngineOk({ requiredForms: ['424A', 'SF-424'], results: [] })
      )
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
      results: [
        { program: 'p', requiredForms: ['form_424A'], missing_fields: ['m'] },
      ],
      requiredForms: ['form_sf424', 'form_424A'],
      lastUpdated: new Date().toISOString(),
    };
    await updateCase(caseId, { eligibility });
    const res = await request(app)
      .get('/api/eligibility-report')
      .query({ caseId });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.eligibility.requiredForms)).toBe(true);
    expect(res.body.eligibility.requiredForms).toEqual([
      'form_sf424',
      'form_424A',
    ]);
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
