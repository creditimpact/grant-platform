const express = require('express');
const { createCase, getCase } = require('../utils/pipelineStore');

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
    documents: c.documents,
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
    documents: c.documents,
    normalized: c.normalized,
  });
});

module.exports = router;
module.exports.caseStatusHandler = caseStatusHandler;
