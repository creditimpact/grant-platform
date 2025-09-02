process.env.SKIP_DB = 'true';
const request = require('supertest');

let createCase;
let resetStoreFn;

describe('Invoices_or_Quotes checklist integration', () => {
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
        green_energy_state_incentive: { required_docs: ['Invoices_or_Quotes'], common_docs: [] },
        energy_efficiency_upgrade: { required_docs: ['Invoices_or_Quotes'], common_docs: [] },
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

  test('uploading invoice and quote dedupes and persists status', async () => {
    const caseId = await createCase('dev-user');

    // Initial eligibility
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
      (d) => d.doc_type === 'Invoices_or_Quotes'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('not_uploaded');

    // Upload invoice
    global.pipelineFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          doc_type: 'Invoices_or_Quotes',
          fields: {
            doc_variant: 'invoice',
            invoice_number: 'INV-1001',
            issue_date: '2025-01-05',
            total_amount: 5400,
            vendor_name: 'ACME Solar Corp',
            customer_name: 'Green Energy LLC',
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
      .field('key', 'Invoices_or_Quotes')
      .attach('file', Buffer.from('dummy'), 'invoice.pdf');
    expect(res.status).toBe(200);
    items = res.body.requiredDocuments.filter(
      (d) => d.doc_type === 'Invoices_or_Quotes'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('extracted');
    expect(res.body.documents).toHaveLength(1);

    // Upload quote later
    global.pipelineFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          doc_type: 'Invoices_or_Quotes',
          fields: {
            doc_variant: 'quote',
            quote_number: 'Q-2002',
            quote_valid_until: '2025-03-31',
            total_amount: 1728,
            vendor_name: 'Sunshine Installers',
            customer_name: 'Green Energy LLC',
          },
          doc_confidence: 0.88,
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
      .field('key', 'Invoices_or_Quotes')
      .attach('file', Buffer.from('dummy'), 'quote.pdf');
    expect(res.status).toBe(200);
    items = res.body.requiredDocuments.filter(
      (d) => d.doc_type === 'Invoices_or_Quotes'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('extracted');
    expect(res.body.documents).toHaveLength(1);

    // Eligibility removes grants
    global.pipelineFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
      headers: { get: () => 'application/json' },
    });

    res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: { foo: 'bar' } });
    expect(res.status).toBe(200);
    items = res.body.requiredDocuments.filter(
      (d) => d.doc_type === 'Invoices_or_Quotes'
    );
    expect(items).toHaveLength(0);

    // Re-add one grant
    global.pipelineFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ key: 'green_energy_state_incentive', score: 1 }],
      }),
      headers: { get: () => 'application/json' },
    });

    res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: { foo: 'bar' } });
    expect(res.status).toBe(200);
    items = res.body.requiredDocuments.filter(
      (d) => d.doc_type === 'Invoices_or_Quotes'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('extracted');
  });
});
