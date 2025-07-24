const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'files route' });
});

module.exports = router;
