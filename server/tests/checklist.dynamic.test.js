process.env.SKIP_DB = 'true';
const request = require('supertest');
let createCase;
let updateCase;
let resetStoreFn;
let getCase;

const grantsLibrary = {
  grant1: {
    required_docs: ['IRS_941X', 'DocA'],
    common_docs: [],
  },
  grant2: {
    required_docs: ['IRS_941X', 'DocB'],
    common_docs: [],
  },
};

describe('dynamic checklist refresh', () => {
  let app;
  beforeEach(() => {
    jest.resetModules();
    const store = require('../utils/pipelineStore');
    createCase = store.createCase;
    updateCase = store.updateCase;
    resetStoreFn = store.resetStore;
    getCase = store.getCase;
    resetStoreFn();
    global.pipelineFetch = jest.fn();
    jest
      .spyOn(require('../utils/documentLibrary'), 'loadGrantsLibrary')
      .mockResolvedValue(grantsLibrary);
    app = require('../index');
  });

  afterEach(() => {
    resetStoreFn();
    jest.restoreAllMocks();
  });

  test('adds and removes docs as grants change', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, {
      documents: [{ doc_type: 'IRS_941X', status: 'extracted' }],
    });

    // Step1: engine returns grant1
    global.pipelineFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ key: 'grant1', score: 1 }] }),
    });
    let res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: { foo: 'bar' } });
    expect(res.status).toBe(200);
    let types = res.body.requiredDocuments.map((d) => d.doc_type);
    expect(types).toEqual(expect.arrayContaining(['IRS_941X', 'DocA']));

    // Step2: engine returns grant1 + grant2
    global.pipelineFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { key: 'grant1', score: 1 },
          { key: 'grant2', score: 1 },
        ],
      }),
    });
    res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: { foo: 'bar' } });
    types = res.body.requiredDocuments.map((d) => d.doc_type);
    expect(types).toEqual(
      expect.arrayContaining(['IRS_941X', 'DocA', 'DocB'])
    );
    const irs = res.body.requiredDocuments.find((d) => d.doc_type === 'IRS_941X');
    expect(irs.status).toBe('extracted');

    // Step3: engine returns only grant2
    global.pipelineFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ key: 'grant2', score: 1 }] }),
    });
    res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: { foo: 'bar' } });
    types = res.body.requiredDocuments.map((d) => d.doc_type);
    expect(types).toEqual(expect.arrayContaining(['IRS_941X', 'DocB']));
    expect(types).not.toContain('DocA');
    const irs2 = res.body.requiredDocuments.find((d) => d.doc_type === 'IRS_941X');
    expect(irs2.status).toBe('extracted');

    const finalCase = await getCase('dev-user', caseId);
    expect(finalCase.documents[0].status).toBe('extracted');
  });
});
