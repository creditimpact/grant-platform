const request = require('supertest');
process.env.SKIP_DB = 'true';
global.fetch = jest.fn();
const app = require('../index');
const { resetStore } = require('../utils/pipelineStore');

describe('POST /api/files/upload', () => {
  beforeEach(() => {
    process.env.SKIP_DB = 'true';
    resetStore();
    global.fetch.mockReset();
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
    expect(res.body).toEqual({ message: 'Unsupported file type' });
  });

  test('rejects oversized file', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .attach('file', Buffer.alloc(6 * 1024 * 1024), 'big.pdf');
    expect(res.status).toBe(413);
  });
});

describe('file upload merge', () => {
  beforeEach(() => {
    process.env.SKIP_DB = 'true';
    resetStore();
    global.fetch.mockReset();
  });

  test('new analyzer values overwrite old fields', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ein: '111111111' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ein: '222222222' }),
      });

    const first = await request(app)
      .post('/api/files/upload')
      .attach('file', Buffer.from('%PDF'), 'first.pdf');
    const caseId = first.body.caseId;

    const second = await request(app)
      .post('/api/files/upload')
      .field('caseId', caseId)
      .attach('file', Buffer.from('%PDF'), 'second.pdf');

    expect(second.body.analyzerFields.ein).toBe('222222222');
  });

  test('existing fields preserved if not in new set', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ w2_employee_count: 5 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ein: '222222222' }),
      });

    const first = await request(app)
      .post('/api/files/upload')
      .attach('file', Buffer.from('%PDF'), 'first.pdf');
    const caseId = first.body.caseId;

    const second = await request(app)
      .post('/api/files/upload')
      .field('caseId', caseId)
      .attach('file', Buffer.from('%PDF'), 'second.pdf');

    expect(second.body.analyzerFields).toEqual({
      w2_employee_count: 5,
      ein: '222222222',
    });
  });

  test('non-overlapping fields merged correctly', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ annual_revenue: 500000 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entity_type: 'C-Corp' }),
      });

    const first = await request(app)
      .post('/api/files/upload')
      .attach('file', Buffer.from('%PDF'), 'first.pdf');
    const caseId = first.body.caseId;

    const second = await request(app)
      .post('/api/files/upload')
      .field('caseId', caseId)
      .attach('file', Buffer.from('%PDF'), 'second.pdf');

    expect(second.body.analyzerFields).toEqual({
      annual_revenue: 500000,
      entity_type: 'C-Corp',
    });
  });
});
