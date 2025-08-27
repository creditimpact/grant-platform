const { renderPdf } = require('../utils/pdfRenderer');
const logger = require('../utils/logger');

describe('pdfRenderer', () => {
  test('renders acro template', async () => {
    const buf = await renderPdf({
      formId: 'form_sf424',
      filledForm: { applicant_name: 'ACME', ein: '12-3456789' },
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(buf.includes('%%EOF')).toBe(true);
  });

  test('renders absolute template', async () => {
    const buf = await renderPdf({
      formId: 'form_424A',
      filledForm: { applicant_name: 'ACME' },
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(buf.includes('%%EOF')).toBe(true);
  });

  test('logs missing fields and draws overlay when enabled', async () => {
    logger.logs.length = 0;
    process.env.PDF_DEBUG_OVERLAY = 'true';
    const buf = await renderPdf({
      formId: 'form_sf424',
      filledForm: {},
    });
    const pdfString = buf.toString();
    expect(pdfString).toContain('MISSING:applicant_name');
    const log = logger.logs.find(
      (l) => l.message === 'pdf_render_missing_field' && l.key === 'applicant_name'
    );
    expect(log).toBeTruthy();
    delete process.env.PDF_DEBUG_OVERLAY;
  });

  test('logs missing fields without overlay when disabled', async () => {
    logger.logs.length = 0;
    const buf = await renderPdf({
      formId: 'form_sf424',
      filledForm: {},
    });
    const pdfString = buf.toString();
    expect(pdfString).not.toContain('MISSING:applicant_name');
    const log = logger.logs.find(
      (l) => l.message === 'pdf_render_missing_field' && l.key === 'applicant_name'
    );
    expect(log).toBeTruthy();
  });
});
