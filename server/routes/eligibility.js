const express = require('express');
const router = express.Router();

// GET /api/eligibility-report
router.get('/', (req, res) => {
  // For now, just return dummy data
  res.json({
    eligible: true,
    message: 'Eligibility report stub'
  });
});

module.exports = router;
