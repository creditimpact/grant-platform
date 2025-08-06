const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const auth = require('../middleware/authMiddleware');
const { createCase, updateCase, getCase } = require('../utils/pipelineStore');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @typedef {Object} RawSubmission
 * @property {Object.<string, any>} fields - user supplied form fields
 * @property {File[]} files - uploaded documents
 */

/**
 * @typedef {Object} NormalizedData
 * @property {Object.<string, any>} data - cleaned submission ready for eligibility checks
 */

/**
 * @typedef {Object} EligibilityResult
 * @property {Object[]} grants - grant eligibility results
 * @property {string[]} requiredForms - names of forms to generate
 */

/**
 * @typedef {Object} FormFillResult
 * @property {{ formType: string, url: string }[]} filledForms - generated PDFs
 */

// Main submission endpoint
router.post('/submit-case', auth, upload.any(), async (req, res) => {
  console.log('➡️  /submit-case payload', {
    user: req.user.id,
    fields: Object.keys(req.body),
    files: req.files.map((f) => f.originalname),
  });

  const caseId = createCase(req.user.id);
  try {
    // ---- AI Analyzer step ----
    const analyzerBase = process.env.AI_ANALYZER_URL || 'http://localhost:8000';
    const analyzerUrl = `${analyzerBase.replace(/\/$/, '')}/analyze`;
    let extracted = {};
    for (const file of req.files) {
      const form = new FormData();
      form.append('file', file.buffer, file.originalname);
      console.log(`→ POST ${analyzerUrl}`, { file: file.originalname });
      const resp = await fetch(analyzerUrl, {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
      });
      if (!resp.ok) {
        const text = await resp.text();
        console.error('AI analyzer error', resp.status, text);
        updateCase(caseId, { status: 'error', error: text });
        return res
          .status(502)
          .json({ message: `AI analyzer error ${resp.status}`, details: text });
      }
      const fields = await resp.json();
      console.log('← AI analyzer response', fields);
      extracted = { ...extracted, ...fields };
    }
    const normalized = { ...req.body, ...extracted };
    console.log('Normalized data', normalized);
    updateCase(caseId, { status: 'analyzed', normalized });

    // ---- Eligibility Engine ----
    const engineBase = process.env.ELIGIBILITY_ENGINE_URL || 'http://localhost:4001';
    const engineUrl = `${engineBase.replace(/\/$/, '')}/check`;
    console.log(`→ POST ${engineUrl}`);
    const eligResp = await fetch(engineUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    });
    if (!eligResp.ok) {
      const text = await eligResp.text();
      console.error('Eligibility engine error', eligResp.status, text);
      updateCase(caseId, { status: 'error', error: text });
      return res.status(502).json({ message: `Eligibility engine error ${eligResp.status}`, details: text });
    }
    const eligibility = await eligResp.json();
    console.log('← Eligibility engine response', eligibility);
    updateCase(caseId, { status: 'checked', eligibility });

    // ---- AI Agent form filling ----
    const agentBase = process.env.AI_AGENT_URL || 'http://localhost:5001';
    const agentUrl = `${agentBase.replace(/\/$/, '')}/form-fill`;
    const filled = {};
    for (const formName of eligibility.requiredForms || []) {
      console.log(`→ POST ${agentUrl}`, { form: formName });
      const agentResp = await fetch(agentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_name: formName, user_payload: normalized }),
      });
      if (!agentResp.ok) {
        const text = await agentResp.text();
        console.error('AI agent form-fill error', agentResp.status, text);
        updateCase(caseId, { status: 'error', error: text });
        return res
          .status(502)
          .json({ message: `AI agent form-fill error ${agentResp.status}`, details: text });
      }
      const agentData = await agentResp.json();
      console.log('← AI agent response', agentData);
      filled[formName] = agentData.filled_form || agentData;
    }
    updateCase(caseId, { status: 'forms_filled', documents: filled });

    // ---- Placeholder: digital signature & submission hooks ----
    // updateCase(caseId, { status: 'signed' });

    res.json({ caseId, eligibility, documents: filled });
  } catch (err) {
    console.error('Pipeline processing failed:', err);
    updateCase(caseId, { status: 'error', error: err.message });
    res.status(500).json({ message: 'Pipeline failed', error: err.message });
  }
});

// Status endpoint
router.get('/status/:caseId', auth, (req, res) => {
  const c = getCase(req.user.id, req.params.caseId);
  if (!c) return res.status(404).json({ message: 'Case not found' });
  res.json({ status: c.status, eligibility: c.eligibility, documents: c.documents });
});

module.exports = router;
