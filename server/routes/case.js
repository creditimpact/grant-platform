const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const auth = require('../middleware/authMiddleware');
const { getCase, computeDocuments } = require('../utils/caseStore');

const router = express.Router();

// --- Questionnaire ---
router.get('/case/questionnaire', auth, (req, res) => {
  console.log('➡️  GET /case/questionnaire', { user: req.user.id });
  const c = getCase(req.user.id, false);
  res.json(c?.answers || {});
});

router.post('/case/questionnaire', auth, async (req, res) => {
  console.log('➡️  POST /case/questionnaire', { user: req.user.id, body: req.body });
  try {
    const c = getCase(req.user.id);
    c.answers = { ...c.answers, ...req.body };
    c.documents = await computeDocuments(c.answers);
    c.status = 'questionnaire';
    res.json({ message: 'saved' });
  } catch (err) {
    console.error('POST /case/questionnaire failed', err);
    res.status(500).json({ message: 'Failed to save questionnaire' });
  }
});

// --- Case Status ---
router.get('/case/status', auth, async (req, res) => {
  console.log('➡️  GET /case/status', { user: req.user.id });
  const c = getCase(req.user.id, false);
  if (!c || !c.answers || Object.keys(c.answers).length === 0) {
    return res.json({ status: 'not_started' });
  }
  if (!c.documents || c.documents.length === 0) {
    c.documents = await computeDocuments(c.answers);
  }
  res.json({
    status: c.status || 'open',
    documents: c.documents,
    eligibility: c.eligibility || null,
  });
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

router.post('/files/upload', auth, upload.single('file'), async (req, res) => {
  const { key } = req.body;
  console.log('➡️  POST /files/upload', { user: req.user.id, key, file: req.file?.originalname });
  if (!key || !req.file) return res.status(400).json({ message: 'Missing key or file' });
  try {
    const c = getCase(req.user.id);
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
      doc.url = `/uploads/${req.file.filename}`;
    }
    c.status = 'documents';
    res.json({ message: 'uploaded', document: doc });
  } catch (err) {
    console.error('POST /files/upload failed', err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// --- Eligibility Report ---
router.get('/eligibility-report', auth, (req, res) => {
  console.log('➡️  GET /eligibility-report', { user: req.user.id });
  const c = getCase(req.user.id, false);
  if (!c || !c.eligibility) return res.status(404).json({ message: 'No report available' });
  res.json(c.eligibility);
});

router.post('/eligibility-report', auth, async (req, res) => {
  console.log('➡️  POST /eligibility-report', { user: req.user.id });
  const c = getCase(req.user.id, false);
  if (!c) return res.status(400).json({ message: 'No case found' });
  try {
    const form = new FormData();
    form.append('payload', JSON.stringify(c.answers || {}));
    if (Array.isArray(c.documents)) {
      c.documents
        .filter((d) => d.uploaded && d.path)
        .forEach((d) => form.append('files', fs.createReadStream(d.path), d.originalname || d.key));
    }
    const aiBase = process.env.AI_AGENT_URL || 'http://localhost:5001';
    const aiUrl = `${aiBase.replace(/\/$/, '')}/analyze`;
    console.log(`→ POST ${aiUrl}`);
    const aiResp = await fetch(aiUrl, { method: 'POST', body: form, headers: form.getHeaders() });
    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error('AI agent error', aiResp.status, text);
      return res.status(502).json({ message: `AI agent error ${aiResp.status}`, details: text });
    }
    const normalized = await aiResp.json();
    console.log('← AI agent response', normalized);

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
      return res.status(502).json({ message: `Eligibility engine error ${eligResp.status}`, details: text });
    }
    const eligibility = await eligResp.json();
    console.log('← Eligibility engine response', eligibility);

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
      return res.status(502).json({ message: `Form filler error ${fillerResp.status}`, details: text });
    }
    const filled = await fillerResp.json();
    console.log('← Form filler response', filled);

    c.eligibility = eligibility;
    c.generatedForms = filled;
    c.status = 'results';
    res.json({ eligibility, documents: filled });
  } catch (err) {
    console.error('POST /eligibility-report failed', err);
    res.status(500).json({ message: 'Eligibility computation failed', error: err.message });
  }
});

module.exports = router;
