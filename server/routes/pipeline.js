const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const fetchFn = global.pipelineFetch || (global.fetch ? global.fetch.bind(global) : (...args) => import('node-fetch').then(({ default: f }) => f(...args)));
const { createCase, updateCase, getCase } = require('../utils/pipelineStore');
const logger = require('../utils/logger');
const { validate, schemas } = require('../middleware/validate');
const { getLatestTemplate } = require('../utils/formTemplates');
const { validateAgainstSchema } = require('../middleware/formValidation');
const { getServiceHeaders } = require('../utils/serviceHeaders');

const router = express.Router();

function aggregateMissing(results) {
  return [...new Set(results.flatMap((r) => r.missing_fields || []))];
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.post('/submit-case', upload.any(), validate(schemas.pipelineSubmit), async (req, res) => {
  const userId = 'dev-user';
  const { caseId: providedCaseId, ...basePayload } = req.body;
  const caseId = await createCase(userId, providedCaseId);
  try {
    const docMeta = req.files.map((f) => ({
      originalname: f.originalname,
      path: f.path,
      mimetype: f.mimetype,
      size: f.size,
    }));
    await updateCase(caseId, { documents: docMeta });

    const analyzerBase = process.env.AI_ANALYZER_URL || 'http://localhost:8002';
    const analyzerUrl = `${analyzerBase.replace(/\/$/, '')}/analyze`;
    let extracted = {};
    for (const file of req.files) {
      const form = new FormData();
      form.append('file', fs.createReadStream(file.path), file.originalname);
      const resp = await fetchFn(analyzerUrl, {
        method: 'POST',
        body: form,
        headers: { ...form.getHeaders(), ...getServiceHeaders('AI_ANALYZER', req) },
      });
      if (!resp.ok) {
        const text = await resp.text();
        await updateCase(caseId, { status: 'error', error: text });
        return res.status(502).json({ message: `AI analyzer error ${resp.status}`, details: text });
      }
      const fields = await resp.json();
      extracted = { ...extracted, ...fields };
    }
    const overrideKeys = Object.keys(basePayload).filter((key) =>
      Object.prototype.hasOwnProperty.call(extracted, key)
    );
    if (overrideKeys.length) {
      logger.debug(`Overriding analyzer fields: ${overrideKeys.join(', ')}`);
    }
    const normalized = { ...extracted, ...basePayload };
    await updateCase(caseId, { status: 'analyzed', normalized, analyzer: extracted });

    const engineBase = process.env.ELIGIBILITY_ENGINE_URL || 'http://localhost:4001';
    const engineUrl = `${engineBase.replace(/\/$/, '')}/check`;
    const eligResp = await fetchFn(engineUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getServiceHeaders('ELIGIBILITY_ENGINE', req) },
      body: JSON.stringify(normalized),
    });
    if (!eligResp.ok) {
      const text = await eligResp.text();
      await updateCase(caseId, { status: 'error', error: text });
      return res.status(502).json({ message: `Eligibility engine error ${eligResp.status}`, details: text });
    }
    const eligibility = await eligResp.json();
    await updateCase(caseId, { status: 'checked', eligibility });

    // Aggregate required forms from all eligibility results
    const requiredForms = Array.isArray(eligibility)
      ? [...new Set(eligibility.flatMap((r) => r.requiredForms || []))]
      : eligibility.requiredForms || [];

    const agentBase = process.env.AI_AGENT_URL || 'http://localhost:5001';
    const agentUrl = `${agentBase.replace(/\/$/, '')}/form-fill`;
    const filledForms = [];
    for (const formName of requiredForms) {
      const agentResp = await fetchFn(agentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getServiceHeaders('AI_AGENT', req) },
        body: JSON.stringify({
          form_name: formName,
          user_payload: normalized,
          analyzer_fields: extracted,
        }),
      });
      if (!agentResp.ok) {
        const text = await agentResp.text();
        await updateCase(caseId, { status: 'error', error: text });
        return res
          .status(502)
          .json({ message: `AI agent form-fill error ${agentResp.status}`, details: text });
      }
      const agentData = await agentResp.json();
      const tmpl = await getLatestTemplate(formName);
      const version = tmpl ? tmpl.version : 1;
      const formData = agentData.filled_form || agentData;
      const validationErrors = tmpl ? validateAgainstSchema(formData, tmpl.schema) : [];
      if (validationErrors.length) {
        await updateCase(caseId, { status: 'error', error: 'validation_failed' });
        return res.status(400).json({ errors: validationErrors });
      }
      filledForms.push({ formKey: formName, version, data: formData });
    }
    await updateCase(caseId, { status: 'forms_filled', generatedForms: filledForms });

    res.json({ caseId, eligibility, generatedForms: filledForms });
  } catch (err) {
    for (const f of req.files || []) fs.unlink(f.path, () => {});
    await updateCase(caseId, { status: 'error', error: err.message });
    res.status(500).json({ message: err.message, error: err.message });
  }
});

router.get('/status/:caseId', async (req, res) => {
  const userId = 'dev-user';
  const c = await getCase(userId, req.params.caseId);
  if (!c) return res.status(404).json({ message: 'Case not found' });
  const missing = c.eligibility?.results
    ? aggregateMissing(c.eligibility.results)
    : [];
  res.json({
    caseId: c.caseId,
    createdAt: c.createdAt,
    status: c.status,
    analyzer: c.analyzer,
    analyzerFields: c.analyzer?.fields,
    questionnaire: {
      data: c.questionnaire?.data || {},
      missingFieldsHint: missing,
      lastUpdated: c.questionnaire?.lastUpdated,
    },
    eligibility: c.eligibility,
    generatedForms: c.generatedForms,
    documents: c.documents,
    normalized: c.normalized,
  });
});

module.exports = router;
