const express = require('express');

// Log so we can verify that the route file is actually loaded
console.log('Case route loaded');

const router = express.Router();

const auth = require('../middleware/authMiddleware');
const { getCase, createCase, computeDocuments } = require('../utils/caseStore');

// Status endpoint used by the dashboard
router.get('/status', auth, (req, res) => {
  const c = getCase(req.user.id, false);

  if (!c) {
    return res.json({ status: 'not_started' });
  }

  res.json({
    status: c.status,
    documents: c.documents,
    eligibility: c.eligibility,
    answers: c.answers,
  });
});

// Save questionnaire answers
router.post('/questionnaire', auth, (req, res) => {
  const c = createCase(req.user.id);
  c.answers = req.body || {};
  c.documents = computeDocuments(c.answers);
  res.json({ status: 'saved' });
});

// Fetch questionnaire answers
router.get('/questionnaire', auth, (req, res) => {
  const c = createCase(req.user.id);
  res.json(c.answers || {});
});

module.exports = router;
