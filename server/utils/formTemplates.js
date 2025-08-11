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

module.exports = { getLatestTemplate, getTemplate, cacheTemplate, cache };
