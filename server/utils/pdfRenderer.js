const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { pdfTemplates } = require('./formTemplates');
const logger = require('./logger');

const FLATTEN = process.env.FLATTEN !== 'false';
const DEBUG_MISSING = process.env.PDF_DEBUG_MISSING === 'true';

function formatValue(formId, key, v) {
  if (v === null || v === undefined || v === '') {
    logger.warn('pdf_render_missing_field', { formId, key });
    return DEBUG_MISSING ? `MISSING:${key}` : '';
  }
  if (v instanceof Date) return new Date(v).toLocaleDateString('en-US');
  if (typeof v === 'number') return v.toLocaleString('en-US');
  return String(v);
}

async function renderPdf({ formId, filledForm }) {
  if (!filledForm) throw new Error('filledForm required');
  const tmpl = pdfTemplates[formId];
  const caseId = filledForm.caseId || filledForm.case_id;

  if (!tmpl) {
    logger.error('pdf_render_failed', { formId, caseId, error: 'template_not_found' });
    throw new Error('template_not_found');
  }

  logger.info('pdf_render_started', { formId, caseId, mode: tmpl.mode });

  const basePath = path.join(__dirname, '..', 'templates', tmpl.base);
  let baseBytes;
  try {
    baseBytes = fs.readFileSync(basePath);
  } catch (err) {
    logger.error('pdf_render_failed', { formId, caseId, error: 'missing_base_template' });
    throw err;
  }

  const pdfDoc = await PDFDocument.load(baseBytes);
  const pages = pdfDoc.getPages();
  const form = pdfDoc.getForm();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fields = filledForm.fields || filledForm;

  if (tmpl.mode === 'acro') {
    for (const [key, fieldName] of Object.entries(tmpl.fields || {})) {
      const value = formatValue(formId, key, fields[key]);
      try {
        const field = form.getTextField(fieldName);
        field.setText(value);
        logger.info('pdf_render_field_mapped', { formId, key, fieldName });
      } catch (err) {
        logger.warn('pdf_render_missing_field', { formId, key });
      }
    }
    if (FLATTEN) form.flatten();
  } else if (tmpl.mode === 'absolute') {
    for (const [key, cfg] of Object.entries(tmpl.coords || {})) {
      const value = formatValue(formId, key, fields[key]);
      const page = pages[cfg.page || 0];
      page.drawText(value, {
        x: cfg.x,
        y: cfg.y,
        size: cfg.fontSize || 9,
        font,
      });
      logger.info('pdf_render_field_mapped', { formId, key, coords: cfg });
    }
    for (const [key, cfg] of Object.entries(tmpl.checkboxes || {})) {
      const page = pages[cfg.page || 0];
      const raw = fields[key];
      if (raw === undefined || raw === null || raw === '') {
        logger.warn('pdf_render_missing_field', { formId, key });
      }
      const mark = raw ? 'X' : '';
      page.drawText(mark, {
        x: cfg.x,
        y: cfg.y,
        size: cfg.size || 9,
        font,
      });
    }
  } else {
    logger.error('pdf_render_failed', { formId, caseId, error: 'unknown_mode' });
    throw new Error('unknown_mode');
  }

  const pdfBytes = await pdfDoc.save();
  const buf = Buffer.from(pdfBytes);
  const valid = buf.slice(0, 5).toString() === '%PDF-' && buf.includes('%%EOF');
  if (!valid) {
    logger.error('pdf_render_failed', { formId, caseId, error: 'invalid_pdf' });
    throw new Error('invalid_pdf');
  }
  logger.info('pdf_render_succeeded', { formId, caseId, size: buf.length });
  return buf;
}

module.exports = { renderPdf };
