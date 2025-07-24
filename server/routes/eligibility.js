const express = require('express');
const router = express.Router();

// @route   GET /api/eligibility
// @desc    Simple eligibility check based on age and income
router.get('/', (req, res) => {
  const { age, income } = req.query;

  if (!age || !income) {
    return res.status(400).json({ message: 'Missing age or income' });
  }

  const eligible = Number(age) >= 18 && Number(income) < 50000;
  res.json({ eligible });
});

module.exports = router;
