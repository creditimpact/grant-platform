process.env.SKIP_DB = 'true';
const request = require('supertest');

let createCase;
let getCase;
let updateCase;
let resetStoreFn;

describe('Grant Use Statement checklist integration', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    const store = require('../utils/pipelineStore');
    createCase = store.createCase;
    getCase = store.getCase;
    updateCase = store.updateCase;
    resetStoreFn = store.resetStore;
    resetStoreFn();
    global.pipelineFetch = jest.fn();
    jest
      .spyOn(require('../utils/documentLibrary'), 'loadGrantsLibrary')
      .mockResolvedValue({
        grantA: { required_docs: ['Grant_Use_Statement'], common_docs: [] },
        grantB: { required_docs: ['Grant_Use_Statement'], common_docs: [] },
      });
    app = require('../index');
  });

  afterEach(() => {
    resetStoreFn();
    jest.restoreAllMocks();
    delete global.pipelineFetch;
  });

  test('appears once and preserves generated status', async () => {
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
      (d) => d.doc_type === 'Grant_Use_Statement'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('not_uploaded');

    const c = await getCase('dev-user', caseId);
    c.documents.push({ doc_type: 'Grant_Use_Statement', status: 'generated' });
    await updateCase(caseId, { documents: c.documents });

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

    res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: { foo: 'bar' } });
    expect(res.status).toBe(200);
    items = res.body.requiredDocuments.filter(
      (d) => d.doc_type === 'Grant_Use_Statement'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('generated');

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
      (d) => d.doc_type === 'Grant_Use_Statement'
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('generated');

    res = await request(app)
      .get('/api/case/required-documents')
      .query({ caseId });
    expect(res.status).toBe(200);
    const checklistItems = res.body.required.filter(
      (d) => d.doc_type === 'Grant_Use_Statement'
    );
    expect(checklistItems).toHaveLength(1);
    expect(checklistItems[0].status).toBe('generated');
  });
});
