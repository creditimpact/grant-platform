const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  res.json({ user: { email: req.body.email || 'dev@example.com' } });
});

router.post('/register', (req, res) => {
  res.json({ user: { email: req.body.email || 'dev@example.com' } });
});

router.post('/logout', (req, res) => {
  res.json({ message: 'logged out' });
});

router.get('/me', (req, res) => {
  res.json({ email: 'dev@example.com' });
});

module.exports = router;
