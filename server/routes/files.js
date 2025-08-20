const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fetchFn =
  global.pipelineFetch ||
  (global.fetch
    ? global.fetch.bind(global)
    : (...args) => import('node-fetch').then(({ default: f }) => f(...args)));
const { createCase, getCase, updateCase } = require('../utils/pipelineStore');
const { getServiceHeaders } = require('../utils/serviceHeaders');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function isAllowed(mimetype) {
  return ['application/pdf', 'image/jpeg', 'image/png'].includes(mimetype);
}

router.post('/files/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'File too large' });
      }
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) return res.status(400).json({ message: 'file required' });
    if (!isAllowed(req.file.mimetype)) {
      return res.status(400).json({ message: 'Unsupported file type' });
    }

    const userId = 'dev-user';
    let { caseId, key } = req.body || {};
    if (caseId) {
      const existing = await getCase(userId, caseId);
      if (!existing) return res.status(404).json({ message: 'Case not found' });
    } else {
      caseId = await createCase(userId);
    }

    const analyzerBase = process.env.AI_ANALYZER_URL || 'http://localhost:8000';
    const analyzerUrl = `${analyzerBase.replace(/\/$/, '')}/analyze`;
    const form = new FormData();
    form.append('file', req.file.buffer, { filename: req.file.originalname });
    const resp = await fetchFn(analyzerUrl, {
      method: 'POST',
      body: form,
      headers: { ...form.getHeaders(), ...getServiceHeaders('AI_ANALYZER', req) },
    });
    if (!resp.ok) {
      const text = await resp.text();
      return res
        .status(502)
        .json({ message: `AI analyzer error ${resp.status}`, details: text });
    }
    const fields = await resp.json();
    const c = await getCase(userId, caseId);
    const existingFields = (c.analyzer && c.analyzer.fields) || {};
    const mergedFields = { ...fields, ...existingFields };
    const now = new Date().toISOString();
    const docMeta = {
      key,
      filename: req.file.originalname,
      size: req.file.size,
      contentType: req.file.mimetype,
      uploadedAt: now,
    };
    const documents = [...(c.documents || []), docMeta];
    await updateCase(caseId, {
      analyzer: { fields: mergedFields, lastUpdated: now },
      documents,
    });
    res.json({
      caseId,
      status: c.status || 'open',
      documents,
      analyzer: { fields: mergedFields, lastUpdated: now },
      analyzerFields: mergedFields,
    });
  });
});

module.exports = router;
