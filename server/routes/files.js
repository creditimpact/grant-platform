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
const {
  getRequiredDocs,
  getDocType,
  loadGrantsLibrary,
} = require('../utils/documentLibrary');
const { normalizeFields } = require('../utils/fieldNormalizer');
const { buildChecklist } = require('../utils/checklistBuilder');
const { preferCleanFields } = require('../utils/preferCleanFields');
const { detectDocType } = require('../services/docType');
const { extractBankStatement } = require('../services/extractors/bankStatement');
const { extractPOA } = require('../services/extractors/poa');
const { extractProofOfAddress } = require('../services/extractors/proofOfAddress');

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
    let { doc_type, doc_confidence, fields, fields_clean, ...businessFields } = analysis;
    const ocrText = analysis.ocrText || analysis.text || '';
    const detected = detectDocType(ocrText);
    if (detected.type === 'bank_statement' && detected.confidence >= 0.8) {
      const parsed = extractBankStatement({ text: ocrText, vendor: detected.vendor, confidence: detected.confidence });
      fields_clean = preferCleanFields(fields_clean || {}, { bank_statements: [parsed] });
    }
    if (detected.type === 'power_of_attorney' && detected.confidence >= 0.8) {
      const poa = extractPOA({ text: ocrText, confidence: detected.confidence });
      const existingAuth =
        (fields_clean && fields_clean.legal && fields_clean.legal.authorizations) || [];
      fields_clean = {
        ...(fields_clean || {}),
        legal: {
          ...(fields_clean?.legal || {}),
          authorizations: [...existingAuth, poa],
        },
      };
    }
    if (detected.type === 'proof_of_address' && detected.confidence >= 0.8) {
      const poaRes = extractProofOfAddress({ text: ocrText, hints: detected.hints || {}, confidence: detected.confidence });
      const existingAddr =
        (fields_clean && fields_clean.identity && fields_clean.identity.address_proofs) || [];
      fields_clean = {
        ...(fields_clean || {}),
        identity: {
          ...(fields_clean?.identity || {}),
          address_proofs: [...existingAddr, poaRes],
        },
      };
    }
    const docFields = preferCleanFields({ fields, fields_clean });
    const normalizedDocFields = normalizeFields(docFields || {});
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
    const existingFields = preferCleanFields(c.analyzer || {});
    const mergedInput = { ...businessFields, ...normalizedDocFields };
    const { merged: mergedFields, updatedKeys } = safeMerge(
      existingFields,
      mergedInput,
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
      const normFields = { ...normalizedDocFields };
      if (normFields.payment_amount != null) {
        normFields.payment_amount = currency(normFields.payment_amount);
      }
      if (normFields.payment_date) {
        normFields.payment_date = new Date(normFields.payment_date)
          .toISOString()
          .split('T')[0];
      }
      let status = 'extracted';
      if (key && doc_type && key !== doc_type) {
        status = 'mismatch';
      }
      const existing = documents.find((d) => d.doc_type === doc_type);
      const history = existing ? [...(existing.history || []), existing] : undefined;
      documents = documents.filter((d) => d.doc_type !== doc_type);
      documents.push({
        doc_type,
        status,
        evidence_key: evidence_key || key,
        analyzer_fields: normFields,
        file_name: req.file.originalname,
        uploadedAt: now,
        requestId: req.headers['x-request-id'],
        ...(history ? { history } : {}),
      });
    } else {
      const docType = evidence_key || key;
      const existing = documents.find((d) => d.doc_type === docType);
      const history = existing ? [...(existing.history || []), existing] : undefined;
      documents = documents.filter((d) => d.doc_type !== docType);
      documents.push({
        doc_type: docType,
        status: 'uploaded',
        evidence_key: evidence_key || key,
        file_name: req.file.originalname,
        size: req.file.size,
        contentType: req.file.mimetype,
        uploadedAt: now,
        ...(history ? { history } : {}),
      });
    }

    // Re-run eligibility engine with merged data
    const eligibilityPayload = {
      ...(c.questionnaire?.data || {}),
      ...normalized,
    };
    let eligibility = c.eligibility || { results: [] };
    try {
      const BASE = process.env.ELIGIBILITY_ENGINE_URL || 'http://localhost:4001';
      const PATH = process.env.ELIGIBILITY_ENGINE_PATH || '/check';
      const engineUrl = new URL(PATH, BASE).toString();
      const eligResp = await fetchFn(engineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getServiceHeaders('ELIGIBILITY_ENGINE', req),
        },
        body: JSON.stringify(eligibilityPayload),
      });
      if (eligResp.ok) {
        const body = await eligResp.json();
        const results = Array.isArray(body)
          ? body
          : Array.isArray(body?.results)
              ? body.results
              : [];
        eligibility = {
          results,
          lastUpdated: new Date().toISOString(),
        };
      }
    } catch (e) {
      // ignore eligibility errors
    }

    const shortlisted = (eligibility.results || [])
      .filter((r) => r?.score != null && r.score >= 0)
      .map((r) => r.key);
    const grantsLibrary = await loadGrantsLibrary();
    const { required } = await buildChecklist({
      shortlistedGrants: shortlisted,
      grantsLibrary,
      caseDocuments: documents,
    });

    await updateCase(caseId, {
      analyzer: { fields: normalized, lastUpdated: now },
      documents,
      eligibility,
      requiredDocuments: required,
    });
    res.json({
      caseId,
      status: c.status || 'open',
      documents,
      analyzer: { fields: normalized, lastUpdated: now },
      analyzerFields: normalized,
      eligibility,
      requiredDocuments: required,
    });
  });
});

module.exports = router;
