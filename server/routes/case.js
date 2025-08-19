const express = require('express');
const router = express.Router();

function caseStatusHandler(req, res) {
  res.json({
    caseId: 'dev-case',
    status: 'open',
    requiredDocuments: [],
    eligibility: null,
    lastUpdated: new Date().toISOString(),
  });
}

router.get('/case/status', caseStatusHandler);

module.exports = router;
module.exports.caseStatusHandler = caseStatusHandler;
