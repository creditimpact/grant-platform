const { renderPdf } = require('../utils/pdfRenderer');

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
});
