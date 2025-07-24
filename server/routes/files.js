const express = require('express');
const router = express.Router();
// Placeholder
router.get('/', (req, res) => {
  res.json({ message: 'files route' });
});
module.exports = router;
