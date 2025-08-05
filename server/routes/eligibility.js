const express = require('express');
console.log('Eligibility route loaded');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getCase } = require('../utils/caseStore');

// GET /api/eligibility-report
router.post('/', auth, async (req, res) => {
  const c = getCase(req.user.id, false);
  if (!c) return res.status(400).json({ message: 'No active case' });
  const answers = c.answers || {};
  const agentBase = process.env.AGENT_URL || 'http://localhost:5001';
  const endpoint = agentBase
    ? `${agentBase.replace(/\/$/, '')}/check`
    : `${(process.env.ELIGIBILITY_ENGINE_URL || 'http://localhost:4001').replace(/\/$/, '')}/check`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error('Eligibility engine error:', response.status, text);
      return res.status(502).json({ message: 'Engine unavailable' });
    }

    const data = await response.json();
    c.eligibility = {
      eligible: Array.isArray(data) ? data.some((r) => r.eligible) : false,
      summary: Array.isArray(data) && data.some((r) => r.eligible)
        ? 'You appear eligible for some grants.'
        : 'No matching grants found.',
      results: data,
    };
    res.json(c.eligibility);
  } catch (err) {
    console.error('Error calling eligibility engine:', err.message);
    res.status(502).json({ message: 'Engine unavailable' });
  }
});

router.get('/', auth, (req, res) => {
  const c = getCase(req.user.id, false);
  if (!c) return res.status(400).json({ message: 'No active case' });
  res.json(c.eligibility || { eligible: false });
});

module.exports = router;
