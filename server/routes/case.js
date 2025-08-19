const express = require('express');
const { getCase, getLatestCase } = require('../utils/pipelineStore');

const router = express.Router();

async function caseStatusHandler(req, res) {
  const userId = 'dev-user';
  const caseId = req.query.caseId;
  let c;
  if (caseId) {
    c = await getCase(userId, caseId);
  } else {
    c = await getLatestCase(userId);
  }
  if (!c) return res.status(404).json({ message: 'Case not found' });
  res.json({
    caseId: c.caseId,
    createdAt: c.createdAt,
    status: c.status,
    analyzer: c.analyzer,
    eligibility: c.eligibility,
    generatedForms: c.generatedForms,
    documents: c.documents,
    normalized: c.normalized,
  });
}

router.get('/case/status', caseStatusHandler);

module.exports = router;
module.exports.caseStatusHandler = caseStatusHandler;
