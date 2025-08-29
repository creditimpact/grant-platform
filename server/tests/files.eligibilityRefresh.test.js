const request = require('supertest');
process.env.SKIP_DB = 'true';
let app;

beforeEach(() => {
  global.pipelineFetch = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        doc_type: 'IRS_941X',
        fields: { ein: '12-3456789', year: '2021' },
        doc_confidence: 0.9,
      }),
      headers: { get: () => 'application/json' },
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ program: 'sample', status: 'eligible', certainty: 0.8 }],
      }),
      headers: { get: () => 'application/json' },
    });
  app = require('../index');
});

afterEach(() => {
  delete global.pipelineFetch;
  jest.resetModules();
});

test('upload triggers analyzer and eligibility refresh', async () => {
  const res = await request(app)
    .post('/api/files/upload')
    .attach('file', Buffer.from('dummy'), '941x.pdf');
  expect(res.status).toBe(200);
  const doc = res.body.documents[0];
  expect(doc.analyzer_fields.employer_identification_number).toBe('12-3456789');
  expect(res.body.eligibility.results).toHaveLength(1);
  expect(global.pipelineFetch).toHaveBeenCalledTimes(2);
  const secondCall = global.pipelineFetch.mock.calls[1];
  const payload = JSON.parse(secondCall[1].body);
  expect(payload.employer_identification_number).toBe('12-3456789');
});
