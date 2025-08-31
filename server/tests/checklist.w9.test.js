process.env.SKIP_DB = 'true';
const request = require('supertest');

let createCase;
let resetStoreFn;
let getCase;

describe('W9 checklist integration', () => {
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
        grantA: { required_docs: ['W9_Form'], common_docs: [] },
        grantB: { required_docs: ['W9_Form'], common_docs: [] },
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

  test('dedupes W9 form and preserves status', async () => {
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
    let items = res.body.requiredDocuments.filter(
      (d) => d.doc_type === 'W9_Form'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('not_uploaded');

    global.pipelineFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          doc_type: 'W9_Form',
          fields: { tin: '12-3456789' },
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
      .attach('file', Buffer.from('dummy'), 'w9.pdf');
    expect(res.status).toBe(200);
    items = res.body.requiredDocuments.filter(
      (d) => d.doc_type === 'W9_Form'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('extracted');

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
      (d) => d.doc_type === 'W9_Form'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('extracted');

    res = await request(app)
      .get('/api/case/required-documents')
      .query({ caseId });
    expect(res.status).toBe(200);
    const checklistItems = res.body.required.filter(
      (d) => d.doc_type === 'W9_Form'
    );
    expect(checklistItems).toHaveLength(1);
    expect(checklistItems[0].status).toBe('extracted');
  });
});
