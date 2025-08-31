process.env.SKIP_DB = 'true';
const request = require('supertest');
let createCase;
let updateCase;
let resetStoreFn;
let getCase;

const grantsLibrary = {
  grant1: {
    required_docs: ['Articles_Of_Incorporation', 'DocA'],
    common_docs: [],
  },
  grant2: {
    required_docs: ['Articles_Of_Incorporation', 'DocB'],
    common_docs: [],
  },
};

describe('dynamic checklist refresh for Articles_Of_Incorporation', () => {
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

  test('preserves uploaded Articles_Of_Incorporation across eligibility refreshes', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, {
      documents: [{ doc_type: 'Articles_Of_Incorporation', status: 'uploaded' }],
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
    expect(types).toEqual(
      expect.arrayContaining(['Articles_Of_Incorporation', 'DocA'])
    );
    let aoi = res.body.requiredDocuments.find(
      (d) => d.doc_type === 'Articles_Of_Incorporation'
    );
    expect(aoi.status).toBe('uploaded');

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
      expect.arrayContaining([
        'Articles_Of_Incorporation',
        'DocA',
        'DocB',
      ])
    );
    aoi = res.body.requiredDocuments.find(
      (d) => d.doc_type === 'Articles_Of_Incorporation'
    );
    expect(aoi.grants.sort()).toEqual(['grant1', 'grant2']);
    expect(aoi.status).toBe('uploaded');

    // Step3: engine returns only grant2
    global.pipelineFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ key: 'grant2', score: 1 }] }),
    });
    res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: { foo: 'bar' } });
    types = res.body.requiredDocuments.map((d) => d.doc_type);
    expect(types).toEqual(
      expect.arrayContaining(['Articles_Of_Incorporation', 'DocB'])
    );
    expect(types).not.toContain('DocA');
    aoi = res.body.requiredDocuments.find(
      (d) => d.doc_type === 'Articles_Of_Incorporation'
    );
    expect(aoi.status).toBe('uploaded');

    const finalCase = await getCase('dev-user', caseId);
    expect(finalCase.documents[0].status).toBe('uploaded');
  });
});

