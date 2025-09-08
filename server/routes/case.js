const express = require('express');
const { createCase, getCase } = require('../utils/pipelineStore');
const { buildChecklist } = require('../utils/checklistBuilder');
const Case = require('../models/Case');
const { loadGrantsLibrary } = require('../utils/documentLibrary');
const { preferCleanFields } = require('../utils/preferCleanFields');

const router = express.Router();

function aggregateMissing(results) {
  return [...new Set(results.flatMap((r) => r.missing_fields || []))];
}

async function caseStatusHandler(req, res) {
  const userId = 'dev-user';
  const caseId = req.query.caseId;
  if (!caseId) {
    return res.json({ caseId: null, status: 'empty' });
  }
  const c = await getCase(userId, caseId);
  if (!c) return res.json({ caseId: null, status: 'empty' });
  const missing = c.eligibility?.results
    ? aggregateMissing(c.eligibility.results)
    : [];
  res.json({
    caseId: c.caseId,
    createdAt: c.createdAt,
    status: c.status,
    analyzer: c.analyzer,
    analyzerFields: preferCleanFields(c.analyzer || {}),
    questionnaire: {
      data: c.questionnaire?.data || {},
      missingFieldsHint: missing,
      lastUpdated: c.questionnaire?.lastUpdated,
    },
    eligibility: c.eligibility,
    generatedForms: c.generatedForms,
    incompleteForms: c.incompleteForms,
    documents: c.documents,
    requiredDocuments: c.requiredDocuments,
    normalized: c.normalized,
  });
}

router.get('/case/status', caseStatusHandler);

router.post('/case/init', async (req, res) => {
  const userId = 'dev-user';
  const caseId = await createCase(userId);
  const c = await getCase(userId, caseId);
  const missing = c.eligibility?.results
    ? aggregateMissing(c.eligibility.results)
    : [];
  res.json({
    caseId: c.caseId,
    createdAt: c.createdAt,
    status: c.status,
    analyzer: c.analyzer,
    analyzerFields: preferCleanFields(c.analyzer || {}),
    questionnaire: {
      data: c.questionnaire?.data || {},
      missingFieldsHint: missing,
      lastUpdated: c.questionnaire?.lastUpdated,
    },
    eligibility: c.eligibility,
    generatedForms: c.generatedForms,
    incompleteForms: c.incompleteForms,
    documents: c.documents,
    requiredDocuments: c.requiredDocuments,
    normalized: c.normalized,
  });
});

router.get('/case/required-documents', async (req, res) => {
  const requestId = req.get('X-Request-Id');
  const { caseId } = req.query;
  if (!caseId) return res.status(400).json({ error: 'missing caseId' });

  try {
    const doc = await Case.findOne({ caseId }).lean();
    if (!doc) return res.status(404).json({ error: 'unknown case' });

    const shortlisted = (doc.eligibility?.results || [])
      .filter((r) => r?.score != null && r.score >= 0)
      .map((r) => r.key);

    const grantsLibrary = await loadGrantsLibrary();
    const { required } = await buildChecklist({
      shortlistedGrants: shortlisted,
      grantsLibrary,
      caseDocuments: doc.documents || [],
    });

    return res.json({
      caseId,
      required,
      meta: { shortlisted_grants: shortlisted, count: required.length },
    });
  } catch (err) {
    console.error('[required-documents]', { requestId, err });
    return res.status(500).json({ error: 'server_error', requestId });
  }
});

module.exports = router;
module.exports.caseStatusHandler = caseStatusHandler;
