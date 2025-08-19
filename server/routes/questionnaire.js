const express = require('express');
const { createCase, getCase, updateCase } = require('../utils/pipelineStore');

const router = express.Router();

function aggregateMissing(results) {
  return [
    ...new Set(results.flatMap((r) => r.missing_fields || [])),
  ];
}

router.get('/case/questionnaire', async (req, res) => {
  const userId = 'dev-user';
  const { caseId } = req.query;
  if (!caseId) return res.status(400).json({ message: 'caseId required' });
  const c = await getCase(userId, caseId);
  if (!c) return res.status(404).json({ message: 'Case not found' });
  const data = c.questionnaire?.data || {};
  const missing = c.eligibility?.results ? aggregateMissing(c.eligibility.results) : [];
  res.json({
    caseId,
    questionnaire: {
      data,
      missingFieldsHint: missing,
      lastUpdated: c.questionnaire?.lastUpdated,
    },
  });
});

router.post('/case/questionnaire', async (req, res) => {
  const userId = 'dev-user';
  let { caseId, data } = req.body || {};
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ message: 'data required' });
  }
  let c;
  if (caseId) {
    c = await getCase(userId, caseId);
    if (!c) return res.status(404).json({ message: 'Case not found' });
  } else {
    caseId = await createCase(userId);
    c = await getCase(userId, caseId);
  }
  const existingFields = (c.analyzer && c.analyzer.fields) || {};
  const merged = { ...existingFields };
  for (const [k, v] of Object.entries(data)) {
    if (
      merged[k] === undefined ||
      merged[k] === null ||
      merged[k] === ''
    ) {
      merged[k] = v;
    }
  }
  const now = new Date().toISOString();
  await updateCase(caseId, {
    analyzer: { fields: merged, lastUpdated: now },
    questionnaire: { data, lastUpdated: now },
  });
  const missing = c.eligibility?.results ? aggregateMissing(c.eligibility.results) : [];
  res.json({
    caseId,
    questionnaire: { data, missingFieldsHint: missing, lastUpdated: now },
  });
});

module.exports = router;
