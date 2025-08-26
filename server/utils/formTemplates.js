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
  },
  form_424A: {
    base: 'form_424A.pdf',
    mode: 'absolute',
    coords: {
      applicant_name: { page: 0, x: 50, y: 700, fontSize: 12 },
    },
  },
  form_RD_400_1: { base: 'form_RD_400_1.pdf', mode: 'absolute', coords: {} },
  form_RD_400_4: { base: 'form_RD_400_4.pdf', mode: 'absolute', coords: {} },
  form_RD_400_8: { base: 'form_RD_400_8.pdf', mode: 'absolute', coords: {} },
};

module.exports = { getLatestTemplate, getTemplate, cacheTemplate, cache, pdfTemplates };
