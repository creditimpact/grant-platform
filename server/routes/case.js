const express = require('express');
const router = express.Router();

router.get('/case/status', (req, res) => {
  res.json({ status: 'not_started', documents: [], eligibility: null });
});

module.exports = router;
