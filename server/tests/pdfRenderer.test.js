const { renderPdf } = require('../utils/pdfRenderer');
const logger = require('../utils/logger');

describe('pdfRenderer', () => {
  test('produces valid PDF buffer', async () => {
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
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });

  test('logs missing fields when data incomplete', async () => {
    logger.logs.length = 0;
    await renderPdf({ formId: 'form_sf424', filledForm: {} });
    const log = logger.logs.find((l) => l.message === 'pdf_render_missing_field');
    expect(log).toBeTruthy();
  });
});
