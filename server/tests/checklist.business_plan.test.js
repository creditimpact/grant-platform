process.env.SKIP_DB = 'true';
const request = require('supertest');

let createCase;
let resetStoreFn;

describe('Business Plan checklist integration', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    const store = require('../utils/pipelineStore');
    createCase = store.createCase;
    resetStoreFn = store.resetStore;
    resetStoreFn();
    global.pipelineFetch = jest.fn();
    jest
      .spyOn(require('../utils/documentLibrary'), 'loadGrantsLibrary')
      .mockResolvedValue({
        grantA: { required_docs: ['Business_Plan'], common_docs: [] },
        grantB: { required_docs: ['Business_Plan'], common_docs: [] },
      });
    jest
      .spyOn(require('../models/Case'), 'findOne')
      .mockImplementation(({ caseId }) => ({
        lean: async () => {
          const store = require('../utils/pipelineStore');
          return store.getCase('dev-user', caseId);
        },
      }));
    app = require('../index');
  });

  afterEach(() => {
    resetStoreFn();
    jest.restoreAllMocks();
    delete global.pipelineFetch;
  });

  test('dedupes Business Plan and preserves status', async () => {
    const caseId = await createCase('dev-user');

    // Initial eligibility: both grants shortlisted
    global.pipelineFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { key: 'grantA', score: 1 },
          { key: 'grantB', score: 1 },
        ],
      }),
      headers: { get: () => 'application/json' },
    });

    let res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: { foo: 'bar' } });
    expect(res.status).toBe(200);
    let items = res.body.requiredDocuments.filter(
      (d) => d.doc_type === 'Business_Plan'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('not_uploaded');

    // Upload Business Plan -> analyzer then eligibility
    global.pipelineFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          doc_type: 'Business_Plan',
          fields: { business_name: 'ACME MOTORS LLC' },
          doc_confidence: 0.9,
        }),
        headers: { get: () => 'application/json' },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { key: 'grantA', score: 1 },
            { key: 'grantB', score: 1 },
          ],
        }),
        headers: { get: () => 'application/json' },
      });

    res = await request(app)
      .post('/api/files/upload')
      .field('caseId', caseId)
      .attach('file', Buffer.from('dummy'), 'plan.pdf');
    expect(res.status).toBe(200);
    items = res.body.requiredDocuments.filter(
      (d) => d.doc_type === 'Business_Plan'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('extracted');

    // Re-run eligibility with only one grant
    global.pipelineFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ key: 'grantB', score: 1 }] }),
      headers: { get: () => 'application/json' },
    });

    res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: { foo: 'bar' } });
    expect(res.status).toBe(200);
    items = res.body.requiredDocuments.filter(
      (d) => d.doc_type === 'Business_Plan'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('extracted');

    // Checklist endpoint reflects uploaded Business Plan
    res = await request(app)
      .get('/api/case/required-documents')
      .query({ caseId });
    expect(res.status).toBe(200);
    const checklistItems = res.body.required.filter(
      (d) => d.doc_type === 'Business_Plan'
    );
    expect(checklistItems).toHaveLength(1);
    expect(checklistItems[0].status).toBe('extracted');
  });
});
