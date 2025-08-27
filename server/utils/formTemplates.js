const FormTemplate = require('../models/FormTemplate');

// simple in-memory cache for latest templates
const cache = new Map();

async function getLatestTemplate(key) {
  if (cache.has(key)) return cache.get(key);
  const tmpl = await FormTemplate.findOne({ key }).sort({ version: -1 }).exec();
  if (tmpl) cache.set(key, tmpl);
  return tmpl;
}

async function getTemplate(key, version) {
  return FormTemplate.findOne({ key, version }).exec();
}

function cacheTemplate(doc) {
  if (doc && doc.key) cache.set(doc.key, doc);
}

// mappings for PDF rendering templates
// each entry defines how a given form should be rendered
// using either AcroForm fields or absolute positioning
const pdfTemplates = {
  form_sf424: {
    base: 'form_sf424.pdf',
    mode: 'acro',
    fields: {
      applicant_name: 'SF424.ApplicantName',
      ein: 'SF424.EIN',
    },
    required: ['applicant_name', 'ein'],
  },
  form_424A: {
    base: 'form_424A.pdf',
    mode: 'absolute',
    coords: {
      applicant_name: { page: 0, x: 50, y: 700, fontSize: 12 },
    },
    required: ['applicant_name'],
  },
  // RD 400 series templates currently use absolute positioning for rendering
  form_RD_400_1: {
    base: 'form_RD_400_1.pdf',
    mode: 'absolute',
    coords: {
      recipient_name: { page: 0, x: 100, y: 700 },
      recipient_title: { page: 0, x: 100, y: 680 },
      usda_representative: { page: 0, x: 100, y: 660 },
      agreement_date: { page: 0, x: 430, y: 700 },
    },
    checkboxes: {
      loan: { page: 0, x: 100, y: 640 },
      grant: { page: 0, x: 140, y: 640 },
      loan_guaranty: { page: 0, x: 180, y: 640 },
      other_assistance: { page: 0, x: 220, y: 640 },
    },
    required: ['recipient_name', 'recipient_title', 'usda_representative', 'agreement_date'],
  },
  form_RD_400_4: {
    base: 'form_RD_400_4.pdf',
    mode: 'absolute',
    coords: {
      recipient_name: { page: 0, x: 90, y: 710 },
      recipient_address: { page: 0, x: 90, y: 690 },
      assurance_date: { page: 0, x: 400, y: 650 },
      recipient_title: { page: 0, x: 90, y: 630 },
    },
    checkboxes: {
      corporate: { page: 0, x: 90, y: 610 },
      individual: { page: 0, x: 150, y: 610 },
    },
    required: ['recipient_name', 'recipient_address', 'assurance_date', 'recipient_title'],
  },
  form_RD_400_8: {
    base: 'form_RD_400_8.pdf',
    mode: 'absolute',
    coords: {
      date_of_review: { page: 0, x: 90, y: 720 },
      state: { page: 0, x: 260, y: 720 },
      county: { page: 0, x: 400, y: 720 },
      case_number: { page: 0, x: 90, y: 700 },
      borrower_name: { page: 0, x: 90, y: 680 },
      borrower_address: { page: 0, x: 90, y: 660 },
    },
    checkboxes: {
      source_of_funds_direct: { page: 0, x: 260, y: 700 },
      source_of_funds_insured: { page: 0, x: 310, y: 700 },
    },
    required: ['date_of_review', 'state', 'county', 'case_number', 'borrower_name', 'borrower_address'],
  },
};

module.exports = { getLatestTemplate, getTemplate, cacheTemplate, cache, pdfTemplates };
