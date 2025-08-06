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
    // ---- AI Agent step ----
    const form = new FormData();
    form.append('payload', JSON.stringify(req.body));
    req.files.forEach((file) => form.append('files', file.buffer, file.originalname));
    const aiBase = process.env.AI_AGENT_URL || 'http://localhost:5001';
    const aiUrl = `${aiBase.replace(/\/$/, '')}/analyze`;
    console.log(`→ POST ${aiUrl}`);
    const aiResp = await fetch(aiUrl, { method: 'POST', body: form, headers: form.getHeaders() });
    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error('AI agent error', aiResp.status, text);
      updateCase(caseId, { status: 'error', error: text });
      return res.status(502).json({ message: `AI agent error ${aiResp.status}`, details: text });
    }
    const normalized = await aiResp.json();
    console.log('← AI agent response', normalized);
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

    // ---- Form Filler ----
    const fillerBase = process.env.FORM_FILLER_URL || 'http://localhost:5002';
    const fillerUrl = `${fillerBase.replace(/\/$/, '')}/fill-forms`;
    console.log(`→ POST ${fillerUrl}`);
    const fillerResp = await fetch(fillerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: normalized, forms: eligibility.requiredForms || [] }),
    });
    if (!fillerResp.ok) {
      const text = await fillerResp.text();
      console.error('Form filler error', fillerResp.status, text);
      updateCase(caseId, { status: 'error', error: text });
      return res.status(502).json({ message: `Form filler error ${fillerResp.status}`, details: text });
    }
    const filled = await fillerResp.json();
    console.log('← Form filler response', filled);
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
