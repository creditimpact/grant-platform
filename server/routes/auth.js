const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const auth = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

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
  logger.info('POST /api/auth/register');
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
      logger.audit('auth.register.failure', { email, ip: req.ip, reason: 'exists' });
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({ name, email, password });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h'
    });
    await Session.create({ userId: user._id, token });

    logger.audit('auth.register.success', { email, ip: req.ip, userId: user._id.toString() });
    res.json({ token });
  } catch (err) {
    logger.error('register error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user and return token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

    if (!email || !password) {
      logger.audit('auth.login.failure', { email, ip: req.ip, reason: 'missing_fields' });
      return res.status(400).json({ message: 'Please enter all fields' });
    }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      logger.audit('auth.login.failure', { email, ip: req.ip, reason: 'not_found' });
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      logger.audit('auth.login.failure', { email, ip: req.ip, reason: 'bad_password' });
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    await Session.create({ userId: user._id, token });

    logger.audit('auth.login.success', { email, ip: req.ip, userId: user._id.toString() });
    res.json({ token });
  } catch (err) {
    logger.error('login error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current authenticated user
router.get('/me', auth, async (req, res) => {
  logger.info('GET /me');
  const rawHeader = req.headers.authorization || '';
  const token = rawHeader.startsWith('Bearer ')
    ? rawHeader.split(' ')[1]
    : rawHeader;
  logger.info('Token received', { token: token ? token.substring(0, 10) + '...' : 'none' });

  try {
    logger.info('Decoded JWT', { userId: req.user && req.user.id ? req.user.id : 'none' });
    if (!req.user || !req.user.id) {
      logger.warn('req.user missing user id');
      return res.status(401).json({ message: 'Token is not valid' });
    }
    const user = await User.findById(req.user.id).select('-password');
      logger.info('User lookup result', { userId: user && user._id ? user._id.toString() : 'none' });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    logger.audit('auth.me', { userId: req.user.id, ip: req.ip });
    res.json(user);
  } catch (err) {
    logger.error('me route error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
