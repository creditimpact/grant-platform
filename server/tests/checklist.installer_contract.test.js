process.env.SKIP_DB = 'true';
const request = require('supertest');

let createCase;
let resetStoreFn;

describe('Installer Contract checklist integration', () => {
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
        green_energy_state_incentive: { required_docs: ['Installer_Contract'], common_docs: [] },
        energy_efficiency_upgrade: { required_docs: ['Installer_Contract'], common_docs: [] },
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

  test('dedupes Installer Contract and preserves status', async () => {
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
      (d) => d.doc_type === 'Installer_Contract'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('not_uploaded');

    // Upload Installer Contract -> analyzer then eligibility
    global.pipelineFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          doc_type: 'Installer_Contract',
          fields: {
            provider_name: 'Solar Installers Inc.',
            client_name: 'Green Energy LLC',
            contract_start_date: '2025-01-15',
            contract_end_date: '2025-04-30',
            total_amount: 68900,
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
      .field('key', 'Installer_Contract')
      .attach('file', Buffer.from('dummy'), 'contract.pdf');
    expect(res.status).toBe(200);
    items = res.body.requiredDocuments.filter(
      (d) => d.doc_type === 'Installer_Contract'
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
      (d) => d.doc_type === 'Installer_Contract'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('extracted');

    // Checklist endpoint reflects uploaded Installer Contract
    res = await request(app)
      .get('/api/case/required-documents')
      .query({ caseId });
    expect(res.status).toBe(200);
    const checklistItems = res.body.required.filter(
      (d) => d.doc_type === 'Installer_Contract'
    );
    expect(checklistItems).toHaveLength(1);
    expect(checklistItems[0].status).toBe('extracted');
  });
});
