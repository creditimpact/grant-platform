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

  test('enforces pdfTemplates required fields', async () => {
    const formTemplates = require('../utils/formTemplates');
    jest
      .spyOn(formTemplates, 'getLatestTemplate')
      .mockResolvedValue({ version: 1, schema: {} });
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiredForms: ['form_8974'] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          filled_form: { employer_identification_number: '11-1111111' },
        }),
      });

    const res = await request(app)
      .post('/api/submit-case')
      .field('businessName', 'Biz')
      .field('email', 'a@b.com')
      .field('phone', '1234567');

    expect(res.status).toBe(200);
    expect(res.body.generatedForms).toHaveLength(0);
    expect(res.body.incompleteForms).toHaveLength(1);
    expect(res.body.incompleteForms[0].missingFields).toEqual([
      'name',
      'credit_amount',
    ]);
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

  test('renders RD 400-4 when complete', async () => {
    const formTemplates = require('../utils/formTemplates');
    jest
      .spyOn(formTemplates, 'getLatestTemplate')
      .mockResolvedValue({ version: 1, schema: {} });
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiredForms: ['form_RD_400_4'] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          filled_form: {
            recipient_name: 'ACME',
            recipient_address_street: '123 Main',
            recipient_address_city: 'Town',
            recipient_address_state: 'CA',
            recipient_address_zip: '12345',
            recipient_title: 'CEO',
            date_signed: '2024-01-01',
          },
        }),
      });

    const res = await request(app)
      .post('/api/submit-case')
      .field('businessName', 'Biz')
      .field('email', 'a@b.com')
      .field('phone', '1234567');

    expect(res.status).toBe(200);
    expect(res.body.generatedForms).toHaveLength(1);
    expect(res.body.generatedForms[0].formId).toBe('form_RD_400_4');
    expect(res.body.generatedForms[0].url).toBeTruthy();
    formTemplates.getLatestTemplate.mockRestore();
  });

  test('renders RD 400-1 when complete', async () => {
    const formTemplates = require('../utils/formTemplates');
    jest
      .spyOn(formTemplates, 'getLatestTemplate')
      .mockResolvedValue({ version: 1, schema: {} });
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiredForms: ['form_RD_400_1'] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          filled_form: {
            recipient_name: 'ACME',
            recipient_address_street: '123 Main',
            recipient_address_city: 'Town',
            recipient_address_state: 'CA',
            recipient_address_zip: '12345',
            agreement_date: '2024-01-01',
            recipient_title: 'CEO',
            signing_date: '2024-01-02',
          },
        }),
      });

    const res = await request(app)
      .post('/api/submit-case')
      .field('businessName', 'Biz')
      .field('email', 'a@b.com')
      .field('phone', '1234567');

    expect(res.status).toBe(200);
    expect(res.body.generatedForms).toHaveLength(1);
    expect(res.body.generatedForms[0].formId).toBe('form_RD_400_1');
    expect(res.body.generatedForms[0].url).toBeTruthy();
    formTemplates.getLatestTemplate.mockRestore();
  });

  test('blocks RD 400-1 render when title missing', async () => {
    const formTemplates = require('../utils/formTemplates');
    jest
      .spyOn(formTemplates, 'getLatestTemplate')
      .mockResolvedValue({ version: 1, schema: {} });
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiredForms: ['form_RD_400_1'] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          filled_form: {
            recipient_name: 'ACME',
            recipient_address_street: '123 Main',
            recipient_address_city: 'Town',
            recipient_address_state: 'CA',
            recipient_address_zip: '12345',
            agreement_date: '2024-01-01',
            signing_date: '2024-01-02',
          },
        }),
      });

    const res = await request(app)
      .post('/api/submit-case')
      .field('businessName', 'Biz')
      .field('email', 'a@b.com')
      .field('phone', '1234567');

    expect(res.status).toBe(200);
    expect(res.body.generatedForms).toHaveLength(0);
    expect(res.body.incompleteForms).toHaveLength(1);
    expect(res.body.incompleteForms[0].missingFields).toContain(
      'recipient_title'
    );
    formTemplates.getLatestTemplate.mockRestore();
  });

  test('blocks RD 400-4 render when title missing', async () => {
    const formTemplates = require('../utils/formTemplates');
    jest
      .spyOn(formTemplates, 'getLatestTemplate')
      .mockResolvedValue({ version: 1, schema: {} });
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requiredForms: ['form_RD_400_4'] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          filled_form: {
            recipient_name: 'ACME',
            recipient_address_street: '123 Main',
            recipient_address_city: 'Town',
            recipient_address_state: 'CA',
            recipient_address_zip: '12345',
            date_signed: '2024-01-01',
          },
        }),
      });

    const res = await request(app)
      .post('/api/submit-case')
      .field('businessName', 'Biz')
      .field('email', 'a@b.com')
      .field('phone', '1234567');

    expect(res.status).toBe(200);
    expect(res.body.generatedForms).toHaveLength(0);
    expect(res.body.incompleteForms).toHaveLength(1);
    expect(res.body.incompleteForms[0].missingFields).toContain(
      'recipient_title'
    );
    const log = logger.logs.find((l) => l.message === 'form_fill_validation_failed');
    expect(log).toBeDefined();
    formTemplates.getLatestTemplate.mockRestore();
  });
});
