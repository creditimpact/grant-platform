const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');

// @route   GET /api/users
// @desc    Get all users (protected)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find().select('-password -__v'); // מסיר גם את גרסת המסמך
    res.status(200).json(users);
  } catch (err) {
    console.error('❌ Failed to fetch users:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
