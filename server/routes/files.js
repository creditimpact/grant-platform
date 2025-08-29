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
const { normalizeAnswers, currency } = require('../utils/normalizeAnswers');
const { getRequiredDocs, getDocType } = require('../utils/documentLibrary');

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
    let { caseId, key, evidence_key, grant_key, grantKey } = req.body || {};
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
    if (evidence_key) form.append('evidence_key', evidence_key);
    if (grant_key || grantKey) form.append('grant_key', grant_key || grantKey);

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

    const analysis = await resp.json();
    const { doc_type, fields: docFields, doc_confidence, ...businessFields } = analysis;
    const c = await getCase(userId, caseId);
    const currentGrantKey = grant_key || grantKey || c?.grantKey;
    if (currentGrantKey) {
      const required = getRequiredDocs(currentGrantKey) || [];
      const allowedKeys = new Set(required.map((d) => d.key));
      if (evidence_key && !allowedKeys.has(evidence_key)) {
        return res
          .status(400)
          .json({ error: 'evidence_key not expected for this grant' });
      }
    }
    const existingFields = (c.analyzer && c.analyzer.fields) || {};
    const { merged: mergedFields, updatedKeys } = safeMerge(
      existingFields,
      businessFields,
      {
        source: 'analyzer',
        questionnaire: c.questionnaire?.data || {},
      },
    );
    if (updatedKeys.length) {
      const logFn = logger.debug ? logger.debug.bind(logger) : logger.info.bind(logger);
      logFn('safeMerge updatedKeys', {
        updatedKeys,
        requestId: req.headers['x-request-id'],
      });
    }
    const normalized = normalizeAnswers(mergedFields);
    const now = new Date().toISOString();
    let documents = [...(c.documents || [])];

    if (doc_type && docFields) {
      const spec = getDocType(doc_type);
      if (!spec) {
        return res.status(400).json({ error: 'Unknown doc_type' });
      }
      let requiredFields = [];
      if (spec.extract && spec.extract.fields) {
        requiredFields = Object.entries(spec.extract.fields)
          .filter(([_, cfg]) => cfg.required)
          .map(([k]) => k);
      }
      for (const f of requiredFields) {
        if (!(f in docFields)) {
          return res.status(400).json({ error: `missing field ${f}` });
        }
      }
      const normFields = { ...docFields };
      if (normFields.payment_amount != null) {
        normFields.payment_amount = currency(normFields.payment_amount);
      }
      if (normFields.payment_date) {
        normFields.payment_date = new Date(normFields.payment_date)
          .toISOString()
          .split('T')[0];
      }
      documents.push({
        docType: doc_type,
        fields: normFields,
        fileUrl: req.file.originalname,
        uploadedAt: now,
        requestId: req.headers['x-request-id'],
      });
    } else {
      documents.push({
        key: evidence_key || key,
        evidence_key: evidence_key,
        filename: req.file.originalname,
        size: req.file.size,
        contentType: req.file.mimetype,
        uploadedAt: now,
      });
    }

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
