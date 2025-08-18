const express = require('express');
const FormTemplate = require('../models/FormTemplate');
const { getTemplate, getLatestTemplate, cacheTemplate } = require('../utils/formTemplates');

const router = express.Router();

router.get('/form-template/:key/:version', async (req, res) => {
  const tmpl = await getTemplate(req.params.key, Number(req.params.version));
  if (!tmpl) return res.status(404).json({ message: 'not_found' });
  res.json(tmpl);
});

router.get('/form-template/:key', async (req, res) => {
  const tmpl = await getLatestTemplate(req.params.key);
  if (!tmpl) return res.status(404).json({ message: 'not_found' });
  res.json(tmpl);
});

router.post('/form-template', async (req, res) => {
  const { key, template, schema } = req.body || {};
  if (!key || typeof template !== 'object' || typeof schema !== 'object') {
    return res.status(400).json({ message: 'invalid_payload' });
  }
  const safeTemplate = JSON.parse(JSON.stringify(template));
  const safeSchema = JSON.parse(JSON.stringify(schema));
  const doc = await FormTemplate.createVersion(key, safeTemplate, safeSchema);
  cacheTemplate(doc);
  res.status(201).json(doc);
});

module.exports = router;
