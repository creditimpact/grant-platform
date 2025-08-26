const { renderPdf } = require('../utils/pdfRenderer');

test('renderPdf returns valid PDF buffer', async () => {
  const buf = await renderPdf({ formId: 'form_424A', filledForm: { fields: { a: 1 } } });
  expect(Buffer.isBuffer(buf)).toBe(true);
  expect(buf.length).toBeGreaterThan(0);
  expect(buf.slice(0, 5).toString()).toBe('%PDF-');
  expect(buf.includes('%%EOF')).toBe(true);
});

