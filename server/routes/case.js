const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const auth = require('../middleware/authMiddleware');
const { getCase, computeDocuments } = require('../utils/caseStore');
const { normalizeQuestionnaire, denormalizeQuestionnaire } = require('../utils/validation');

const router = express.Router();

// --- Questionnaire ---
router.get('/case/questionnaire', auth, async (req, res) => {
  console.log('➡️  GET /case/questionnaire', { user: req.user.id });
  const c = await getCase(req.user.id, false);
  const data = c?.answers ? denormalizeQuestionnaire(c.answers) : {};
  res.json(data);
});

router.post('/case/questionnaire', auth, async (req, res) => {
  console.log('➡️  POST /case/questionnaire', { user: req.user.id, body: req.body });
  try {
    const { data, missing, invalid } = normalizeQuestionnaire(req.body);
    if (missing.length || invalid.length) {
      console.log('  ✖ validation failed', { missing, invalid });
      let message = '';
      if (missing.length) message += `Missing required fields: ${missing.join(', ')}`;
      if (invalid.length) {
        if (message) message += '; ';
        message += `Invalid fields: ${invalid.join(', ')}`;
      }
      return res.status(400).json({ message, missing, invalid });
    }
    console.log('  ✓ validation passed', { normalized: data });
    const c = await getCase(req.user.id);
    c.answers = { ...c.answers, ...data };
    c.documents = await computeDocuments(c.answers);
    c.status = 'questionnaire';
    await c.save();
    res.json({ message: 'saved' });
  } catch (err) {
    console.error('POST /case/questionnaire failed', err);
    res.status(500).json({ message: 'Failed to save questionnaire' });
  }
});

// --- Case Status ---
router.get('/case/status', auth, async (req, res) => {
  console.log('➡️  GET /case/status', { user: req.user.id });
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
    console.error('GET /case/status failed', err);
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

router.post('/files/upload', auth, upload.single('file'), async (req, res) => {
  const { key } = req.body;
  console.log('➡️  POST /files/upload', { user: req.user.id, key, file: req.file?.originalname });
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
      doc.url = `/uploads/${req.file.filename}`;
    }
    c.status = 'documents';
    await c.save();
    res.json({ message: 'uploaded', document: doc });
  } catch (err) {
    console.error('POST /files/upload failed', err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// --- Eligibility Report ---
router.get('/eligibility-report', auth, async (req, res) => {
  console.log('➡️  GET /eligibility-report', { user: req.user.id });
  const c = await getCase(req.user.id, false);
  if (!c || !c.eligibility) return res.status(404).json({ message: 'No report available' });
  res.json(c.eligibility);
});

router.post('/eligibility-report', auth, async (req, res) => {
  console.log('➡️  POST /eligibility-report', {
    user: req.user.id,
    body: req.body,
  });

  const c = await getCase(req.user.id, false);
  if (!c) return res.status(400).json({ message: 'No case found' });

  try {
    const { data, missing, invalid } = normalizeQuestionnaire(req.body);
    if (missing.length || invalid.length) {
      console.log('  ✖ validation failed', { missing, invalid });
      let message = '';
      if (missing.length) message += `Missing required fields: ${missing.join(', ')}`;
      if (invalid.length) {
        if (message) message += '; ';
        message += `Invalid fields: ${invalid.join(', ')}`;
      }
      return res.status(400).json({ message, missing, invalid });
    }
    console.log('  ✓ validation passed', { normalized: data });

    c.answers = { ...c.answers, ...data };

    // --- AI Analyzer ---
    const analyzerBase = process.env.AI_ANALYZER_URL || 'http://localhost:8000';
    const analyzerUrl = `${analyzerBase.replace(/\/$/, '')}/analyze`;
    let extracted = {};
    if (Array.isArray(c.documents)) {
      for (const d of c.documents.filter((doc) => doc.uploaded && doc.path)) {
        const form = new FormData();
        form.append('file', fs.createReadStream(d.path), d.originalname || d.key);
        console.log(`→ POST ${analyzerUrl}`, { document: d.key });
        const resp = await fetch(analyzerUrl, {
          method: 'POST',
          body: form,
          headers: form.getHeaders(),
        });
        if (!resp.ok) {
          const text = await resp.text();
          console.error('AI analyzer error', resp.status, text);
          return res
            .status(502)
            .json({ message: `AI analyzer error ${resp.status}`, details: text });
        }
        const fields = await resp.json();
        console.log('← AI analyzer response', fields);
        extracted = { ...extracted, ...fields };
      }
    }
    const normalized = { ...c.answers, ...extracted };
    console.log('Normalized data', normalized);

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
      return res
        .status(502)
        .json({
          message: `Eligibility engine error ${eligResp.status}`,
          details: text,
        });
    }
    const eligibility = await eligResp.json();
    console.log('← Eligibility engine response', eligibility);

    // --- AI Agent form filling ---
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
        return res
          .status(502)
          .json({
            message: `AI agent form-fill error ${agentResp.status}`,
            details: text,
          });
      }
      const agentData = await agentResp.json();
      console.log('← AI agent response', agentData);
      filled[formName] = agentData.filled_form || agentData;
    }

    c.eligibility = eligibility;
    c.generatedForms = filled;
    c.status = 'results';
    await c.save();
    res.json({ eligibility, documents: filled });
  } catch (err) {
    console.error('POST /eligibility-report failed', err);
    res
      .status(500)
      .json({ message: 'Eligibility computation failed', error: err.message });
  }
});

module.exports = router;
