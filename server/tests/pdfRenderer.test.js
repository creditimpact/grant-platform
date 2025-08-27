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
    const filled = {
      employer_identification_number: '98-7654321',
      name: 'ACME',
      calendar_year: '2024',
      credit_reporting_selected_form: 'form_941',
      quarter_selection_selected_quarter: 'q1',
    };
    const rowFields = [
      'ending_date',
      'income_tax_return',
      'date_filed',
      'ein_used',
      'amount_form_6765',
      'credit_taken_previous',
      'remaining_credit',
    ];
    for (let i = 1; i <= 5; i++) {
      rowFields.forEach((f) => {
        filled[`line${i}_${f}`] = f.includes('amount') || f.includes('credit')
          ? 0
          : '2023-12-31';
      });
    }
    Object.assign(filled, {
      line7: 0,
      line8: 0,
      line9: 0,
      line10: 0,
      line11: 0,
      line12: 0,
      line13: 0,
      line14: 0,
      line15: 0,
      line16: 0,
      line17: 0,
    });
    const buf = await renderPdf({ formId: 'form_8974', filledForm: filled });
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

  test('renders RD 400-1 template without missing overlay', async () => {
    logger.logs.length = 0;
    process.env.PDF_DEBUG_OVERLAY = 'true';
    const buf = await renderPdf({
      formId: 'form_RD_400_1',
      filledForm: {
        recipient_name: 'ACME',
        recipient_address_street: '123 Main St',
        recipient_address_city: 'Town',
        recipient_address_state: 'CA',
        recipient_address_zip: '12345',
        agreement_date: '2024-01-01',
        recipient_signature: 'Alice',
        recipient_title: 'CEO',
        signing_date: '2024-01-02',
        corporate_recipient_name: 'ACME',
        president_signature: 'Bob',
        secretary_attest: 'Eve',
        include_equal_opportunity_clause: 'yes',
        notify_unions: 'yes',
        advertising_statement_included: 'yes',
        reporting_access_agreed: 'yes',
        exec_order_compliance_agreed: 'yes',
        subcontractor_flowdown_agreed: 'yes',
        debarred_contractor_blocked: 'yes',
      },
    });
    const pdfString = buf.toString();
    expect(pdfString).not.toContain('MISSING:recipient_name');
    const log = logger.logs.find(
      (l) => l.message === 'pdf_render_missing_field' && l.key === 'recipient_name'
    );
    expect(log).toBeUndefined();
    delete process.env.PDF_DEBUG_OVERLAY;
  });

  test('logs missing fields for RD 400-8', async () => {
    logger.logs.length = 0;
    await renderPdf({ formId: 'form_RD_400_8', filledForm: {} });
    const log = logger.logs.find(
      (l) => l.message === 'pdf_render_missing_field' && l.key === 'state'
    );
    expect(log).toBeTruthy();
  });

  test('renders RD 400-4 without debug overlay when complete', async () => {
    logger.logs.length = 0;
    process.env.PDF_DEBUG_OVERLAY = 'true';
    const buf = await renderPdf({
      formId: 'form_RD_400_4',
      filledForm: {
        recipient_name: 'ACME',
        recipient_address_street: '123 Main',
        recipient_address_city: 'Town',
        recipient_address_state: 'CA',
        recipient_address_zip: '12345',
        recipient_title: 'CEO',
        recipient_signature: 'Alice',
        date_signed: '2024-01-01',
        attest_signature: 'Bob',
        attest_title: 'Witness',
      },
    });
    const pdfString = buf.toString();
    expect(pdfString).not.toContain('MISSING:recipient_name');
    const missingLog = logger.logs.find(
      (l) => l.message === 'pdf_render_missing_field' && l.key === 'recipient_name'
    );
    expect(missingLog).toBeUndefined();
    delete process.env.PDF_DEBUG_OVERLAY;
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
