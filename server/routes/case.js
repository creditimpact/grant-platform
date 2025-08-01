const express = require('express');

// Log so we can verify that the route file is actually loaded
console.log('Case route loaded');

const router = express.Router();

const { getCase } = require('../utils/caseStore');

// Simple status endpoint used by the dashboard
router.get('/status', (req, res) => {
  // Use a static user id for now since auth is optional in this demo
  const c = getCase('demo-user');

  res.json({
    status: c.status,
    documents: c.documents,
    eligibility: c.eligibility,
  });
});

module.exports = router;
