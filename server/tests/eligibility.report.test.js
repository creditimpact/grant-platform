const request = require('supertest');
const nock = require('nock');
const app = require('../index');
const { createCase, updateCase, resetStore } = require('../utils/pipelineStore');

describe('eligibility report endpoints', () => {
  beforeEach(() => {
    process.env.SKIP_DB = 'true';
    resetStore();
    nock.cleanAll();
  });

  test('POST computes and stores eligibility', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: { a: 1 } } });
    nock('http://localhost:4001')
      .post('/check')
      .reply(200, [
        { program: 'p1', requiredForms: ['f1'], missing_fields: ['m1'] },
        { program: 'p2', requiredForms: ['f2'], missing_fields: ['m2'] },
      ]);
    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId, payload: { b: 2 } });
    expect(res.status).toBe(200);
    expect(res.body.eligibility.results).toHaveLength(2);
    expect(res.body.eligibility.requiredForms.sort()).toEqual(['f1', 'f2']);
  });

  test('GET returns latest eligibility', async () => {
    const caseId = await createCase('dev-user');
    const eligibility = {
      results: [{ program: 'p', requiredForms: ['f1'], missing_fields: ['m'] }],
      requiredForms: ['f1'],
      lastUpdated: new Date().toISOString(),
    };
    await updateCase(caseId, { eligibility });
    const res = await request(app)
      .get('/api/eligibility-report')
      .query({ caseId });
    expect(res.status).toBe(200);
    expect(res.body.eligibility.requiredForms).toEqual(['f1']);
    expect(res.body.missingFieldsSummary).toEqual(['m']);
  });

  test('engine error propagates', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, { analyzer: { fields: {} } });
    nock('http://localhost:4001').post('/check').reply(500, 'fail');
    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ caseId });
    expect(res.status).toBe(502);
  });
});
