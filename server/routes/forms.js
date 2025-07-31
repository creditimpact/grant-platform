const express = require('express');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/forms/auto-fill
router.post('/auto-fill', auth, async (req, res) => {
  const agentUrl = process.env.AGENT_URL || 'http://localhost:5001/form-fill';
  try {
    const response = await fetch(agentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Error calling AI agent:', err.message);
    res.status(502).json({ message: 'Agent service unavailable' });
  }
});

module.exports = router;
