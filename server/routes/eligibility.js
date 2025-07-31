const express = require('express');
console.log('Eligibility route loaded');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getCase } = require('../utils/caseStore');

// GET /api/eligibility-report
router.post('/', auth, (req, res) => {
  const c = getCase(req.user.id);
  c.eligibility = {
    eligible: true,
    summary: 'You appear eligible for grants.',
    forms: ['sba_microloan_form']
  };
  res.json(c.eligibility);
});

router.get('/', auth, (req, res) => {
  const c = getCase(req.user.id);
  res.json(c.eligibility || { eligible: false });
});

module.exports = router;
