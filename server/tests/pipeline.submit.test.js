const request = require('supertest');
const path = require('path');
const fs = require('fs');
process.env.SKIP_DB = 'true';
const app = require('../index');
const { resetStore } = require('../utils/pipelineStore');
const logger = require('../utils/logger');

describe('pipeline submit-case', () => {
  const tmpDir = path.join(__dirname, 'tmp-pipeline');
  beforeEach(() => {
    process.env.DRAFTS_DIR = tmpDir;
    resetStore();
    global.fetch = jest.fn();
    logger.logs.length = 0;
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns incomplete form when required fields missing', async () => {
    const pdfRenderer = require('../utils/pdfRenderer');
    const renderSpy = jest.spyOn(pdfRenderer, 'renderPdf');
    const formTemplates = require('../utils/formTemplates');
    jest
      .spyOn(formTemplates, 'getLatestTemplate')
      .mockResolvedValue({
        version: 1,
        schema: { required: ['foo'], properties: { foo: { type: 'string' } } },
      });
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiredForms: ['form_424A'] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ filled_form: {} }),
      });

    const res = await request(app)
      .post('/api/submit-case')
      .field('businessName', 'Biz')
      .field('email', 'a@b.com')
      .field('phone', '1234567');

    expect(res.status).toBe(200);
    expect(res.body.generatedForms).toHaveLength(0);
    expect(res.body.incompleteForms).toHaveLength(1);
    expect(res.body.incompleteForms[0].missingFields).toEqual(['foo']);
    expect(renderSpy).not.toHaveBeenCalled();
    const log = logger.logs.find((l) => l.message === 'form_fill_validation_failed');
    expect(log).toBeDefined();
    renderSpy.mockRestore();
    formTemplates.getLatestTemplate.mockRestore();
  });

  test('renders draft from filled_form', async () => {
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
    expect(res.body.generatedForms[0].url).toBeTruthy();
    const filePath = path.join(tmpDir, res.body.caseId, 'form_424A.pdf');
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
