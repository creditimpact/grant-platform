const request = require('supertest');
const path = require('path');
const fs = require('fs');
process.env.SKIP_DB = 'true';
const app = require('../index');
const { resetStore } = require('../utils/pipelineStore');

describe('pipeline submit-case', () => {
  const tmpDir = path.join(__dirname, 'tmp-pipeline');
  beforeEach(() => {
    process.env.DRAFTS_DIR = tmpDir;
    resetStore();
    global.fetch = jest.fn();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('does not create draft when agent lacks pdf', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiredForms: ['form_424A'] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ filled_form: { foo: 'bar' } }),
      });

    const res = await request(app)
      .post('/api/submit-case')
      .field('businessName', 'Biz')
      .field('email', 'a@b.com')
      .field('phone', '1234567');

    expect(res.status).toBe(200);
    expect(res.body.generatedForms[0].url).toBeUndefined();
    const filePath = path.join(tmpDir, res.body.caseId, 'form_424A.pdf');
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
