const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const auth = require('../middleware/authMiddleware');
const { getCase, computeDocuments } = require('../utils/caseStore');
const { normalizeQuestionnaire, denormalizeQuestionnaire } = require('../utils/validation');
const logger = require('../utils/logger'); // SECURITY FIX: sanitized logging
const { validate, schemas } = require('../middleware/validate'); // SECURITY FIX: schema validation
const { getLatestTemplate } = require('../utils/formTemplates');
const { validateAgainstSchema } = require('../middleware/formValidation');

const router = express.Router();

const serviceHeaders = { 'X-API-Key': process.env.INTERNAL_API_KEY };

// --- Questionnaire ---
router.get('/case/questionnaire', auth, async (req, res) => {
  logger.info('GET /case/questionnaire', { user: req.user.id }); // SECURITY FIX: sanitized logging
  const c = await getCase(req.user.id, false);
  const data = c?.answers ? denormalizeQuestionnaire(c.answers) : {};
  res.json(data);
});

router.post('/case/questionnaire', auth, validate(schemas.caseQuestionnaire), async (req, res) => { // SECURITY FIX: schema validation
  logger.info('POST /case/questionnaire', { user: req.user.id, body: req.body }); // SECURITY FIX: sanitized logging
  try {
    const { data, missing, invalid } = normalizeQuestionnaire(req.body);
    if (missing.length || invalid.length) {
      logger.warn('questionnaire validation failed', { missing, invalid }); // SECURITY FIX: sanitized logging
      let message = '';
      if (missing.length) message += `Missing required fields: ${missing.join(', ')}`;
      if (invalid.length) {
        if (message) message += '; ';
        message += `Invalid fields: ${invalid.join(', ')}`;
      }
      return res.status(400).json({ message, missing, invalid });
    }
    logger.info('questionnaire validation passed', { normalized: data }); // SECURITY FIX: sanitized logging
    const c = await getCase(req.user.id);
    c.answers = { ...c.answers, ...data };
    c.documents = await computeDocuments(c.answers);
    c.status = 'questionnaire';
    await c.save();
    res.json({ message: 'saved' });
  } catch (err) {
    logger.error('POST /case/questionnaire failed', { error: err.message }); // SECURITY FIX: sanitized logging
    res.status(500).json({ message: 'Failed to save questionnaire' });
  }
});

// --- Case Status ---
router.get('/case/status', auth, async (req, res) => {
  logger.info('GET /case/status', { user: req.user.id }); // SECURITY FIX: sanitized logging
  try {
    const c = await getCase(req.user.id, false);
    if (!c || !c.answers || Object.keys(c.answers).length === 0) {
      return res.json({ status: 'not_started' });
    }
    if (!c.documents || c.documents.length === 0) {
      c.documents = await computeDocuments(c.answers);
      await c.save();
    }
    res.json({
      status: c.status || 'open',
      documents: c.documents,
      eligibility: c.eligibility || null,
    });
  } catch (err) {
    logger.error('GET /case/status failed', { error: err.message }); // SECURITY FIX: sanitized logging
    res.status(500).json({ message: 'Failed to retrieve case status' });
  }
});

// --- Document Uploads ---
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

router.post('/files/upload', auth, upload.single('file'), validate(schemas.fileUpload), async (req, res) => { // SECURITY FIX: schema validation
  const { key } = req.body;
  logger.info('POST /files/upload', { user: req.user.id, key, file: req.file?.originalname }); // SECURITY FIX: sanitized logging
  if (!key || !req.file) return res.status(400).json({ message: 'Missing key or file' });
  try {
    const c = await getCase(req.user.id);
    if (!c.documents || c.documents.length === 0) {
      c.documents = await computeDocuments(c.answers);
    }
    let doc = c.documents.find((d) => d.key === key);
    if (!doc) {
      doc = { key, name: key, uploaded: false, url: '' };
      c.documents.push(doc);
    }
    doc.uploaded = true;
    doc.originalname = req.file.originalname;
    doc.mimetype = req.file.mimetype;
    doc.path = req.file.path;
    if (req.file.mimetype.startsWith('image/')) {
      doc.url = `/api/files/${req.file.filename}`; // SECURITY FIX: restrict direct access
    }
    c.status = 'documents';
    await c.save();
    res.json({ message: 'uploaded', document: doc });
  } catch (err) {
    logger.error('POST /files/upload failed', { error: err.message }); // SECURITY FIX: sanitized logging
    res.status(500).json({ message: 'Upload failed' });
  }
});

// SECURITY FIX: authenticated access to uploaded files
router.get('/files/:filename', auth, async (req, res) => {
  const c = await getCase(req.user.id, false);
  const doc = c?.documents?.find((d) => d.path && path.basename(d.path) === req.params.filename);
  if (!doc) {
    return res.status(404).json({ message: 'File not found' });
  }
  res.sendFile(path.resolve(doc.path));
});

// --- Eligibility Report ---
router.get('/eligibility-report', auth, async (req, res) => {
  logger.info('GET /eligibility-report', { user: req.user.id }); // SECURITY FIX: sanitized logging
  const c = await getCase(req.user.id, false);
  if (!c || !c.eligibility) return res.status(404).json({ message: 'No report available' });
  res.json(c.eligibility);
});

router.post('/eligibility-report', auth, validate(schemas.eligibilityReport), async (req, res) => { // SECURITY FIX: schema validation
  logger.info('POST /eligibility-report', { user: req.user.id, body: req.body }); // SECURITY FIX: sanitized logging

  const c = await getCase(req.user.id, false);
  if (!c) return res.status(400).json({ message: 'No case found' });

  try {
    const { data, missing, invalid } = normalizeQuestionnaire(req.body);
    if (missing.length || invalid.length) {
      logger.warn('eligibility-report validation failed', { missing, invalid }); // SECURITY FIX: sanitized logging
      let message = '';
      if (missing.length) message += `Missing required fields: ${missing.join(', ')}`;
      if (invalid.length) {
        if (message) message += '; ';
        message += `Invalid fields: ${invalid.join(', ')}`;
      }
      return res.status(400).json({ message, missing, invalid });
    }
    logger.info('eligibility-report validation passed', { normalized: data }); // SECURITY FIX: sanitized logging

    c.answers = { ...c.answers, ...data };

    // --- AI Analyzer ---
    const analyzerBase = process.env.AI_ANALYZER_URL || 'https://localhost:8000';
    const analyzerUrl = `${analyzerBase.replace(/\/$/, '')}/analyze`;
    let extracted = {};
    if (Array.isArray(c.documents)) {
      for (const d of c.documents.filter((doc) => doc.uploaded && doc.path)) {
        const form = new FormData();
        form.append('file', fs.createReadStream(d.path), d.originalname || d.key);
        logger.info(`POST ${analyzerUrl}`, { document: d.key }); // SECURITY FIX: sanitized logging
        const analyzerHeaders = { ...form.getHeaders(), ...serviceHeaders };
        if (req.id) analyzerHeaders['X-Request-Id'] = req.id;
        const resp = await fetch(analyzerUrl, {
          method: 'POST',
          body: form,
          headers: analyzerHeaders,
        });
        if (!resp.ok) {
          const text = await resp.text();
          logger.error('AI analyzer error', { status: resp.status, details: text }); // SECURITY FIX: sanitized logging
          return res
            .status(502)
            .json({ message: `AI analyzer error ${resp.status}`, details: text });
        }
        const fields = await resp.json();
        logger.info('AI analyzer response', fields); // SECURITY FIX: sanitized logging
        extracted = { ...extracted, ...fields };
      }
    }
    const normalized = { ...c.answers, ...extracted };
    logger.info('Normalized data', normalized); // SECURITY FIX: sanitized logging

    const engineBase = process.env.ELIGIBILITY_ENGINE_URL || 'https://localhost:4001';
    const engineUrl = `${engineBase.replace(/\/$/, '')}/check`;
    logger.info(`POST ${engineUrl}`); // SECURITY FIX: sanitized logging
    const engineHeaders = { 'Content-Type': 'application/json', ...serviceHeaders };
    if (req.id) engineHeaders['X-Request-Id'] = req.id;
    const eligResp = await fetch(engineUrl, {
      method: 'POST',
      headers: engineHeaders,
      body: JSON.stringify(normalized),
    });
    if (!eligResp.ok) {
      const text = await eligResp.text();
      logger.error('Eligibility engine error', { status: eligResp.status, details: text }); // SECURITY FIX: sanitized logging
      return res
        .status(502)
        .json({
          message: `Eligibility engine error ${eligResp.status}`,
          details: text,
        });
    }
    const eligibility = await eligResp.json();
    logger.info('Eligibility engine response', eligibility); // SECURITY FIX: sanitized logging

    // --- AI Agent form filling ---
    const agentBase = process.env.AI_AGENT_URL || 'https://localhost:5001';
    const agentUrl = `${agentBase.replace(/\/$/, '')}/form-fill`;
    const filledForms = [];
    for (const formName of eligibility.requiredForms || []) {
      logger.info(`POST ${agentUrl}`, { form: formName }); // SECURITY FIX: sanitized logging
      const agentHeaders = { 'Content-Type': 'application/json', ...serviceHeaders };
      if (req.id) agentHeaders['X-Request-Id'] = req.id;
      const agentResp = await fetch(agentUrl, {
        method: 'POST',
        headers: agentHeaders,
        body: JSON.stringify({ form_name: formName, user_payload: normalized }),
      });
      if (!agentResp.ok) {
        const text = await agentResp.text();
        logger.error('AI agent form-fill error', { status: agentResp.status, details: text }); // SECURITY FIX: sanitized logging
        return res
          .status(502)
          .json({
            message: `AI agent form-fill error ${agentResp.status}`,
            details: text,
          });
      }
      const agentData = await agentResp.json();
      logger.info('AI agent response', agentData); // SECURITY FIX: sanitized logging
      const tmpl = await getLatestTemplate(formName);
      const version = tmpl ? tmpl.version : 1;
      const formData = agentData.filled_form || agentData;
      const validationErrors = tmpl ? validateAgainstSchema(formData, tmpl.schema) : [];
      if (validationErrors.length) {
        return res.status(400).json({ errors: validationErrors });
      }
      filledForms.push({ formKey: formName, version, data: formData });
    }

    c.eligibility = eligibility;
    c.generatedForms = filledForms;
    c.status = 'results';
    await c.save();
    res.json({ eligibility, generatedForms: filledForms });
  } catch (err) {
    logger.error('POST /eligibility-report failed', { error: err.message }); // SECURITY FIX: sanitized logging
    res
      .status(500)
      .json({ message: 'Eligibility computation failed', error: err.message });
  }
});

module.exports = router;
