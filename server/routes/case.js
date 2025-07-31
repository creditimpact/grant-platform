const express = require('express');
const auth = require('../middleware/authMiddleware');
const { getCase } = require('../utils/caseStore');

const router = express.Router();

// GET /api/case/status
router.get('/status', auth, (req, res) => {
  const c = getCase(req.user.id);
  res.json(c);
});

// POST /api/case/submit
router.post('/submit', auth, (req, res) => {
  const c = getCase(req.user.id);
  c.status = 'Submitted';
  res.json({ status: c.status });
});

module.exports = router;
