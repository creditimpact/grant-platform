const request = require('supertest');
process.env.SKIP_DB = 'true';
global.fetch = jest.fn();
const app = require('../index');
const { resetStore } = require('../utils/pipelineStore');

describe('POST /api/files/upload', () => {
  beforeEach(() => {
    process.env.SKIP_DB = 'true';
    resetStore();
  });

  test('uploads valid pdf and returns case snapshot', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ foo: 'bar' }),
    });
    const res = await request(app)
      .post('/api/files/upload')
      .attach('file', Buffer.from('%PDF'), 'test.pdf');
    expect(res.status).toBe(200);
    expect(res.body.caseId).toBeDefined();
    expect(res.body.documents).toHaveLength(1);
    expect(res.body.analyzerFields.foo).toBe('bar');
  });

  test('rejects bad content type', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .attach('file', Buffer.from('hello'), 'test.txt');
    expect(res.status).toBe(400);
  });

  test('rejects oversized file', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .attach('file', Buffer.alloc(6 * 1024 * 1024), 'big.pdf');
    expect(res.status).toBe(413);
  });
});
