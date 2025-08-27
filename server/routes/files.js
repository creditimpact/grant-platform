const express = require('express');
const multer = require('multer');
const path = require('path');

const { extensions: allowedExtensions } = require('../../shared/file_types.json');
const fetchFn =
  global.pipelineFetch ||
  (global.fetch
    ? global.fetch.bind(global)
    : (...args) => import('node-fetch').then(({ default: f }) => f(...args)));
const { createCase, getCase, updateCase } = require('../utils/pipelineStore');
const { getServiceHeaders } = require('../utils/serviceHeaders');
const logger = require('../utils/logger');
const { safeMerge } = require('../utils/safeMerge');
const { normalizeAnswers } = require('../utils/normalizeAnswers');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function isAllowed(filename) {
  const ext = path.extname(filename).toLowerCase();
  return allowedExtensions.includes(ext);
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
    if (!isAllowed(req.file.originalname)) {
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

    const analyzerBase = (process.env.AI_ANALYZER_URL || 'http://localhost:8002').replace(/\/$/, '');
    const analyzerUrl = `${analyzerBase}/analyze`;

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[files.upload] analyzerUrl=${analyzerUrl}`);
    }

    const form = new FormData();
    const blob = new Blob([req.file.buffer], {
      type: req.file.mimetype || 'application/pdf',
    });
    form.append('file', blob, req.file.originalname);
    if (caseId) form.append('caseId', caseId);
    if (key) form.append('key', key);

    if (process.env.NODE_ENV !== 'production') {
      for (const [key] of form) {
        console.log(`[files.upload] form field: ${key}`);
      }
    }

    let resp;
    try {
      resp = await fetchFn(analyzerUrl, {
        method: 'POST',
        body: form,
        headers: getServiceHeaders('AI_ANALYZER', req),
      });
    } catch (error) {
      return res
        .status(502)
        .json({ message: 'Failed to reach AI analyzer', details: error.message });
    }

    if (!resp.ok) {
      const text = await resp.text();
      res.status(resp.status);
      const ct = resp.headers.get('content-type');
      if (ct) res.set('content-type', ct);
      return res.send(text);
    }

    const fields = await resp.json();
    const c = await getCase(userId, caseId);
    const existingFields = (c.analyzer && c.analyzer.fields) || {};
    const { merged: mergedFields, updatedKeys } = safeMerge(existingFields, fields, {
      source: 'analyzer',
      questionnaire: c.questionnaire?.data || {},
    });
    if (updatedKeys.length) {
      const logFn = logger.debug ? logger.debug.bind(logger) : logger.info.bind(logger);
      logFn('merge: analyzer overrides existing fields', {
        overriddenKeys: updatedKeys,
        requestId: req.headers['x-request-id'],
      });
    }
    const normalized = normalizeAnswers(mergedFields);
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
      analyzer: { fields: normalized, lastUpdated: now },
      documents,
    });
    res.json({
      caseId,
      status: c.status || 'open',
      documents,
      analyzer: { fields: normalized, lastUpdated: now },
      analyzerFields: normalized,
      requiredDocuments: c.requiredDocuments,
    });
  });
});

module.exports = router;
