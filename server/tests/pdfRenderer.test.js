const { renderPdf } = require('../utils/pdfRenderer');
const logger = require('../utils/logger');

describe('pdfRenderer', () => {
  test('renders acro template', async () => {
    const buf = await renderPdf({
      formId: 'form_sf424',
      filledForm: {
        applicant_legal_name: 'ACME',
        ein: '12-3456789',
        descriptive_title: 'Proj',
        project_start_date: '2024-01-01',
        project_end_date: '2024-12-31',
        authorized_rep_name: 'Alice',
        authorized_rep_title: 'CEO',
        authorized_rep_date_signed: '2024-06-01',
        funding_federal: 100,
        funding_total: 100,
      },
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

  test('renders 6765 template', async () => {
    const buf = await renderPdf({
      formId: 'form_6765',
      filledForm: { taxpayer_name: 'ACME', ein: '12-3456789', total_qre: 1000 },
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(buf.includes('%%EOF')).toBe(true);
  });

  test('renders 8974 template', async () => {
    const buf = await renderPdf({
      formId: 'form_8974',
      filledForm: {
        employer_identification_number: '98-7654321',
        name: 'ACME',
        credit_amount: 2000,
      },
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(buf.includes('%%EOF')).toBe(true);
  });

  test('renders RD 400-8 template', async () => {
    const buf = await renderPdf({
      formId: 'form_RD_400_8',
      filledForm: {
        date_of_review: '2024-01-01',
        state: 'CA',
        county: 'Orange',
        case_number: '123',
        borrower_name: 'ACME',
        borrower_address: '123 Main St',
        source_of_funds_direct: true,
        type_of_assistance_community_facilities: true,
      },
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(buf.includes('%%EOF')).toBe(true);
  });

  test('logs missing fields for RD 400-8', async () => {
    logger.logs.length = 0;
    await renderPdf({ formId: 'form_RD_400_8', filledForm: {} });
    const log = logger.logs.find(
      (l) => l.message === 'pdf_render_missing_field' && l.key === 'state'
    );
    expect(log).toBeTruthy();
  });

  test('logs missing fields and draws overlay when enabled', async () => {
    logger.logs.length = 0;
    process.env.PDF_DEBUG_OVERLAY = 'true';
    const buf = await renderPdf({
      formId: 'form_sf424',
      filledForm: {},
    });
    const pdfString = buf.toString();
    expect(pdfString).toContain('MISSING:applicant_legal_name');
    const log = logger.logs.find(
      (l) =>
        l.message === 'pdf_render_missing_field' &&
        l.key === 'applicant_legal_name'
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
    expect(pdfString).not.toContain('MISSING:applicant_legal_name');
    const log = logger.logs.find(
      (l) =>
        l.message === 'pdf_render_missing_field' &&
        l.key === 'applicant_legal_name'
    );
    expect(log).toBeTruthy();
  });
});
