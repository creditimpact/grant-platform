const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const createAgent = require('../utils/tlsAgent');
const auth = require('../middleware/authMiddleware');
const { createCase, updateCase, getCase } = require('../utils/pipelineStore');
const logger = require('../utils/logger'); // SECURITY FIX: sanitized logging
const { validate, schemas } = require('../middleware/validate'); // SECURITY FIX: schema validation
const { scanFile, validateFile } = require('../utils/virusScanner');
const { getLatestTemplate } = require('../utils/formTemplates');
const { validateAgainstSchema } = require('../middleware/formValidation');

const router = express.Router();

const { getServiceHeaders } = require('../utils/serviceHeaders');
const agent = createAgent();

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

const upload = multer({
  storage,
});

// Main submission endpoint
router.post('/submit-case', auth, upload.any(), validate(schemas.pipelineSubmit), async (req, res) => { // SECURITY FIX: schema validation
  logger.info('/submit-case payload', {
    user: req.user.id,
    fields: Object.keys(req.body),
    files: req.files.map((f) => f.originalname),
  }); // SECURITY FIX: sanitized logging

  const caseId = await createCase(req.user.id);
  try {
    for (const f of req.files) {
      validateFile(f);
      await scanFile(f.path);
    }
    const docMeta = req.files.map((f) => ({
      originalname: f.originalname,
      path: f.path,
      mimetype: f.mimetype,
      size: f.size,
    }));
    await updateCase(caseId, { documents: docMeta });

    // ---- AI Analyzer step ----
    const analyzerBase = process.env.AI_ANALYZER_URL || 'https://localhost:8000';
    const analyzerUrl = `${analyzerBase.replace(/\/$/, '')}/analyze`;
    let extracted = {};
    for (const file of req.files) {
      const form = new FormData();
      form.append('file', fs.createReadStream(file.path), file.originalname);
      logger.info(`POST ${analyzerUrl}`, { file: file.originalname }); // SECURITY FIX: sanitized logging
      const analyzerHeaders = {
        ...form.getHeaders(),
        ...getServiceHeaders('AI_ANALYZER'),
      };
      if (req.id) analyzerHeaders['X-Request-Id'] = req.id;
      const resp = await fetch(analyzerUrl, {
        method: 'POST',
        body: form,
        headers: analyzerHeaders,
        agent,
      });
      if (!resp.ok) {
        const text = await resp.text();
        logger.error('AI analyzer error', { status: resp.status, details: text.substring(0, 100) }); // SECURITY FIX: sanitized logging
        await updateCase(caseId, { status: 'error', error: text });
        return res
          .status(502)
          .json({ message: `AI analyzer error ${resp.status}`, details: text });
      }
      const fields = await resp.json();
      logger.info('AI analyzer response', { fields: Object.keys(fields || {}) }); // SECURITY FIX: sanitized logging
      extracted = { ...extracted, ...fields };
    }
    const normalized = { ...req.body, ...extracted };
    await updateCase(caseId, { status: 'analyzed', normalized });

    // ---- Eligibility Engine ----
    const engineBase = process.env.ELIGIBILITY_ENGINE_URL || 'https://localhost:4001';
    const engineUrl = `${engineBase.replace(/\/$/, '')}/check`;
    logger.info(`POST ${engineUrl}`); // SECURITY FIX: sanitized logging
    const engineHeaders = {
      'Content-Type': 'application/json',
      ...getServiceHeaders('ELIGIBILITY_ENGINE'),
    };
    if (req.id) engineHeaders['X-Request-Id'] = req.id;
    const eligResp = await fetch(engineUrl, {
      method: 'POST',
      headers: engineHeaders,
      body: JSON.stringify(normalized),
      agent,
    });
    if (!eligResp.ok) {
      const text = await eligResp.text();
      logger.error('Eligibility engine error', { status: eligResp.status, details: text.substring(0, 100) }); // SECURITY FIX: sanitized logging
      await updateCase(caseId, { status: 'error', error: text });
      return res.status(502).json({ message: `Eligibility engine error ${eligResp.status}`, details: text });
    }
    const eligibility = await eligResp.json();
    logger.info('Eligibility engine response', { fields: Object.keys(eligibility || {}) }); // SECURITY FIX: sanitized logging
    await updateCase(caseId, { status: 'checked', eligibility });

    // ---- AI Agent form filling ----
    const agentBase = process.env.AI_AGENT_URL || 'https://localhost:5001';
    const agentUrl = `${agentBase.replace(/\/$/, '')}/form-fill`;
    const filledForms = [];
    for (const formName of eligibility.requiredForms || []) {
      logger.info(`POST ${agentUrl}`, { form: formName }); // SECURITY FIX: sanitized logging
      const agentHeaders = {
        'Content-Type': 'application/json',
        ...getServiceHeaders('AI_AGENT'),
      };
      if (req.id) agentHeaders['X-Request-Id'] = req.id;
      const agentResp = await fetch(agentUrl, {
        method: 'POST',
        headers: agentHeaders,
        body: JSON.stringify({ form_name: formName, user_payload: normalized }),
        agent,
      });
      if (!agentResp.ok) {
        const text = await agentResp.text();
        logger.error('AI agent form-fill error', { status: agentResp.status, details: text.substring(0, 100) }); // SECURITY FIX: sanitized logging
        await updateCase(caseId, { status: 'error', error: text });
        return res
          .status(502)
          .json({ message: `AI agent form-fill error ${agentResp.status}`, details: text });
      }
      const agentData = await agentResp.json();
      logger.info('AI agent response', { fields: Object.keys(agentData || {}) }); // SECURITY FIX: sanitized logging
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
    logger.error('Pipeline processing failed', { error: err.message }); // SECURITY FIX: sanitized logging
    await updateCase(caseId, { status: 'error', error: err.message });
    const status = err.status || (err.message === 'Virus detected' ? 400 : err.message === 'File too large' ? 413 : err.message === 'Unsupported file type' ? 400 : err.message === 'Virus scan failed' ? 500 : 500);
    res.status(status).json({ message: err.message, error: err.message });
  }
});

// Status endpoint
router.get('/status/:caseId', auth, async (req, res) => {
  const c = await getCase(req.user.id, req.params.caseId);
  if (!c) return res.status(404).json({ message: 'Case not found' });
  res.json({ status: c.status, eligibility: c.eligibility, documents: c.documents, generatedForms: c.generatedForms });
});

router.use((err, req, res, next) => {
  if (err.message === 'File too large') {
    logger.warn('pipeline upload rejected', { reason: 'size' });
    return res.status(413).json({ message: 'File too large' });
  }
  if (err.message === 'Unsupported file type') {
    logger.warn('pipeline upload rejected', { reason: 'type' });
    return res.status(400).json({ message: 'Unsupported file type' });
  }
  next(err);
});

module.exports = router;
