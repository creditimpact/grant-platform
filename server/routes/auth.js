const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// Quick test route to verify router is active
router.get('/test', (req, res) => {
  res.send('Auth route is active!');
});

function validateEmail(email) {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\\.,;:\s@"]+\.)+[^<>()[\]\\.,;:\s@"]{2,})$/i;
  return re.test(String(email).toLowerCase());
}

// @route   POST /api/auth/register
// @desc    Register user and return token
router.post('/register', async (req, res) => {
  console.log('✅ POST /api/auth/register hit');
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ message: 'Invalid email' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({ name, email, password });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h'
    });
    await Session.create({ userId: user._id, token });

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user and return token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    await Session.create({ userId: user._id, token });

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current authenticated user
router.get('/me', auth, async (req, res) => {
  console.log('\uD83D\uDD0D GET /me hit');
  const rawHeader = req.headers.authorization || '';
  const token = rawHeader.startsWith('Bearer ')
    ? rawHeader.split(' ')[1]
    : rawHeader;
  console.log('Token received (partial):', token ? token.substring(0, 10) + '...' : 'none');

  try {
    console.log('Decoded JWT:', req.user);
    if (!req.user || !req.user.id) {
      console.warn('req.user missing user id');
      return res.status(401).json({ message: 'Token is not valid' });
    }
    const user = await User.findById(req.user.id).select('-password');
    console.log('User lookup result:', user);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('Error in /me route:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
