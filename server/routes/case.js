const express = require('express');
const { createCase, getCase, updateCase } = require('../utils/pipelineStore');
const { getRequiredDocuments } = require('../utils/requiredDocuments');

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
    analyzerFields: c.analyzer?.fields,
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
    analyzerFields: c.analyzer?.fields,
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
  const { caseId } = req.query;
  const userId = 'dev-user';
  if (!caseId) return res.status(400).json({ error: 'caseId required' });
  const c = await getCase(userId, caseId);
  if (!c) return res.status(404).json({ error: 'Case not found' });
  let requiredDocs = c.requiredDocuments;
  if (!requiredDocs || !requiredDocs.length) {
    requiredDocs = getRequiredDocuments(c);
    await updateCase(caseId, { requiredDocuments: requiredDocs });
  }
  res.json({ required: requiredDocs });
});

module.exports = router;
module.exports.caseStatusHandler = caseStatusHandler;
