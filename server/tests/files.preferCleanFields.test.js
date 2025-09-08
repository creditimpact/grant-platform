const request = require('supertest');
process.env.SKIP_DB = 'true';

global.pipelineFetch = jest.fn();
const app = require('../index');
const { getCase } = require('../utils/pipelineStore');

afterEach(() => {
  global.pipelineFetch.mockReset();
});

afterAll(() => {
  delete global.pipelineFetch;
});

test('uses fields_clean when provided by analyzer', async () => {
  global.pipelineFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        doc_type: 'W9_Form',
        fields: { tin: 'raw-000' },
        fields_clean: { tin: '33-1340482' },
        doc_confidence: 0.9,
      }),
      headers: { get: () => 'application/json' },
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
      headers: { get: () => 'application/json' },
    });

  const res = await request(app)
    .post('/api/files/upload')
    .attach('file', Buffer.from('dummy'), 'w9.pdf');

  expect(res.status).toBe(200);
  expect(res.body.analyzerFields.employer_identification_number).toBe('33-1340482');
  const c = await getCase('dev-user', res.body.caseId);
  expect(c.analyzer.fields.employer_identification_number).toBe('33-1340482');
});
