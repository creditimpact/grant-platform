process.env.SKIP_DB = 'true';
const request = require('supertest');

let createCase;
let resetStoreFn;

describe('Utility Bill checklist integration', () => {
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
        green_energy_state_incentive: { required_docs: ['Utility_Bill'], common_docs: [] },
        energy_efficiency_upgrade: { required_docs: ['Utility_Bill'], common_docs: [] },
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

  test('dedupes Utility Bill and preserves status', async () => {
    const caseId = await createCase('dev-user');

    // Initial eligibility: both grants shortlisted
    global.pipelineFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { key: 'green_energy_state_incentive', score: 1 },
          { key: 'energy_efficiency_upgrade', score: 1 },
        ],
      }),
      headers: { get: () => 'application/json' },
    });

    let res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: { foo: 'bar' } });
    expect(res.status).toBe(200);
    let items = res.body.requiredDocuments.filter(
      (d) => d.doc_type === 'Utility_Bill'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('not_uploaded');

    // Upload Utility Bill -> analyzer then eligibility
    global.pipelineFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          doc_type: 'Utility_Bill',
          fields: {
            billing_period_start: '2024-01-01',
            billing_period_end: '2024-01-31',
            total_kwh: 234,
            total_amount_due: 56.78,
            utility_provider: 'ACME Energy',
          },
          doc_confidence: 0.9,
        }),
        headers: { get: () => 'application/json' },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { key: 'green_energy_state_incentive', score: 1 },
            { key: 'energy_efficiency_upgrade', score: 1 },
          ],
        }),
        headers: { get: () => 'application/json' },
      });

    res = await request(app)
      .post('/api/files/upload')
      .field('caseId', caseId)
      .field('key', 'Utility_Bill')
      .attach('file', Buffer.from('dummy'), 'bill.pdf');
    expect(res.status).toBe(200);
    items = res.body.requiredDocuments.filter(
      (d) => d.doc_type === 'Utility_Bill'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('extracted');

    // Re-run eligibility with only one grant
    global.pipelineFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ key: 'energy_efficiency_upgrade', score: 1 }],
      }),
      headers: { get: () => 'application/json' },
    });

    res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: { foo: 'bar' } });
    expect(res.status).toBe(200);
    items = res.body.requiredDocuments.filter(
      (d) => d.doc_type === 'Utility_Bill'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('extracted');

    // Checklist endpoint reflects uploaded Utility Bill
    res = await request(app)
      .get('/api/case/required-documents')
      .query({ caseId });
    expect(res.status).toBe(200);
    const checklistItems = res.body.required.filter(
      (d) => d.doc_type === 'Utility_Bill'
    );
    expect(checklistItems).toHaveLength(1);
    expect(checklistItems[0].status).toBe('extracted');
  });
});
