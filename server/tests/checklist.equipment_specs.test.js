process.env.SKIP_DB = 'true';
const request = require('supertest');

let createCase;
let resetStoreFn;

describe('Equipment Specs checklist integration', () => {
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
        green_energy_state_incentive: { required_docs: ['Equipment_Specs'], common_docs: [] },
        energy_efficiency_upgrade: { required_docs: ['Equipment_Specs'], common_docs: [] },
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

  test('dedupes Equipment Specs and preserves status', async () => {
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
      (d) => d.doc_type === 'Equipment_Specs'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('not_uploaded');

    // Upload Equipment Specs -> analyzer then eligibility
    global.pipelineFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          doc_type: 'Equipment_Specs',
          fields: {
            equipment_name: 'Solar PV Panel',
            model_number: 'SP-450W',
            capacity_kw: 0.45,
            efficiency_percent: 21.6,
            certifications: ['UL 1703', 'IEC 61215'],
            manufacturer: 'SolarTech',
            issue_date: '2024-01-15',
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
      .field('key', 'Equipment_Specs')
      .attach('file', Buffer.from('dummy'), 'specs.pdf');
    expect(res.status).toBe(200);
    items = res.body.requiredDocuments.filter(
      (d) => d.doc_type === 'Equipment_Specs'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('extracted');

    // Ensure eligibility refresh received normalized fields
    const secondCall = global.pipelineFetch.mock.calls[2];
    const payload = JSON.parse(secondCall[1].body);
    expect(payload.equipment_name).toBe('Solar PV Panel');
    expect(payload.model_number).toBe('SP-450W');

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
      (d) => d.doc_type === 'Equipment_Specs'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('extracted');

    // Checklist endpoint reflects uploaded Equipment Specs
    res = await request(app)
      .get('/api/case/required-documents')
      .query({ caseId });
    expect(res.status).toBe(200);
    const checklistItems = res.body.required.filter(
      (d) => d.doc_type === 'Equipment_Specs'
    );
    expect(checklistItems).toHaveLength(1);
    expect(checklistItems[0].status).toBe('extracted');
  });
});
