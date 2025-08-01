const express = require('express');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// @route   POST /api/form-fill
// @desc    Forward form fill requests to the AI agent
router.post('/', auth, async (req, res) => {
  const agentBase = process.env.AGENT_URL || 'http://localhost:5001';
  const agentUrl = `${agentBase.replace(/\/$/, '')}/form-fill`;
  try {
    const response = await fetch(agentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      throw new Error(`Agent responded with ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Error calling AI agent:', err.message);
    res.status(502).json({ message: 'Agent service unavailable' });
  }
});

module.exports = router;
