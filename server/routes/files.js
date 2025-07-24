const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.send('Files route works!');
});

module.exports = router;
