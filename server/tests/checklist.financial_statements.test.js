process.env.SKIP_DB = 'true';
const request = require('supertest');

let createCase;
let resetStoreFn;
let getCase;

describe('Financial Statements checklist integration', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    const store = require('../utils/pipelineStore');
    createCase = store.createCase;
    resetStoreFn = store.resetStore;
    getCase = store.getCase;
    resetStoreFn();
    global.pipelineFetch = jest.fn();
    jest
      .spyOn(require('../utils/documentLibrary'), 'loadGrantsLibrary')
      .mockResolvedValue({
        grantA: { required_docs: ['Financial_Statements'], common_docs: [] },
        grantB: { required_docs: ['Financial_Statements'], common_docs: [] },
      });
    const CaseModel = require('../models/Case');
    jest.spyOn(CaseModel, 'findOne').mockImplementation(({ caseId }) => ({
      lean: async () => ({ ...(await getCase('dev-user', caseId)) }),
    }));
    app = require('../index');
  });

  afterEach(() => {
    resetStoreFn();
    jest.restoreAllMocks();
    delete global.pipelineFetch;
  });

  test('expands financial statements and preserves status', async () => {
    const caseId = await createCase('dev-user');

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
    let items = res.body.requiredDocuments.filter((d) =>
      ['Profit_And_Loss_Statement', 'Balance_Sheet'].includes(d.doc_type)
    );
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.status)).toEqual(['not_uploaded', 'not_uploaded']);

    global.pipelineFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          doc_type: 'Profit_And_Loss_Statement',
          fields: { total_revenue: 1000, net_income: 100 },
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
      .attach('file', Buffer.from('dummy'), 'pnl.pdf');
    expect(res.status).toBe(200);
    items = res.body.requiredDocuments.filter((d) =>
      ['Profit_And_Loss_Statement', 'Balance_Sheet'].includes(d.doc_type)
    );
    const statusAfterPnl = items.reduce((m, i) => ({ ...m, [i.doc_type]: i.status }), {});
    expect(statusAfterPnl['Profit_And_Loss_Statement']).toBe('extracted');
    expect(statusAfterPnl['Balance_Sheet']).toBe('not_uploaded');

    global.pipelineFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          doc_type: 'Balance_Sheet',
          fields: { total_assets: 2000, total_equity: 2000 },
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
      .attach('file', Buffer.from('dummy'), 'bs.pdf');
    expect(res.status).toBe(200);
    items = res.body.requiredDocuments.filter((d) =>
      ['Profit_And_Loss_Statement', 'Balance_Sheet'].includes(d.doc_type)
    );
    const statusAfterBs = items.reduce((m, i) => ({ ...m, [i.doc_type]: i.status }), {});
    expect(statusAfterBs['Profit_And_Loss_Statement']).toBe('extracted');
    expect(statusAfterBs['Balance_Sheet']).toBe('extracted');

    global.pipelineFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ key: 'grantB', score: 1 }] }),
      headers: { get: () => 'application/json' },
    });

    res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: { foo: 'bar' } });
    expect(res.status).toBe(200);
    items = res.body.requiredDocuments.filter((d) =>
      ['Profit_And_Loss_Statement', 'Balance_Sheet'].includes(d.doc_type)
    );
    items.forEach((i) => expect(i.status).toBe('extracted'));

    res = await request(app)
      .get('/api/case/required-documents')
      .query({ caseId });
    expect(res.status).toBe(200);
    const checklistItems = res.body.required.filter((d) =>
      ['Profit_And_Loss_Statement', 'Balance_Sheet'].includes(d.doc_type)
    );
    expect(checklistItems).toHaveLength(2);
    checklistItems.forEach((i) => expect(i.status).toBe('extracted'));
  });
});
