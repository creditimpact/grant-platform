const express = require('express');
const router = express.Router();
// Placeholder
router.get('/', (req, res) => {
  res.json({ message: 'users route' });
});
module.exports = router;
