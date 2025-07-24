const express = require('express');
const router = express.Router();

// route זמני לבדיקה
router.get('/', (req, res) => {
  res.send('Auth route is working!');
});

module.exports = router;
