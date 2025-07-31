const express = require('express');

// Log so we can verify that the route file is actually loaded
console.log('Case route loaded');

const router = express.Router();

// Simple status endpoint used by the dashboard
router.get('/status', (req, res) => {
  res.json({
    status: 'open',
    docsUploaded: 2,
    totalDocs: 3
  });
});

module.exports = router;
