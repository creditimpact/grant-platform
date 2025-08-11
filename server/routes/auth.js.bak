const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const auth = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const rateLimit = require('../middleware/rateLimit');
const { csrfProtection, generateCsrfToken } = require('../middleware/csrf');
const { validate, schemas } = require('../middleware/validate');
const parseCookies = require('../utils/cookies');

const router = express.Router();

// Quick test route to verify router is active
router.get('/test', (req, res) => {
  res.send('Auth route is active!');
});

// @route   POST /api/auth/register
// @desc    Register user and return token
router.post(
  '/register',
  rateLimit({ windowMs: 60 * 1000, max: 3, message: 'Too many register attempts' }),
  validate(schemas.register),
  async (req, res) => {
    logger.info('POST /api/auth/register');
    const { name, email, password } = req.body;

    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        logger.audit('auth.register.failure', { email, ip: req.ip, reason: 'exists' });
        return res.status(400).json({ message: 'User already exists' });
      }

      const user = new User({ name, email, password });
      await user.save();

      const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: '10m',
      });
      const refreshToken = crypto.randomBytes(40).toString('hex');
      await Session.create({ userId: user._id, token: refreshToken });
      const csrfToken = generateCsrfToken();

      logger.audit('auth.register.success', { email, ip: req.ip, userId: user._id.toString() });
      res
        .cookie('accessToken', accessToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          maxAge: 10 * 60 * 1000,
        })
        .cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        })
        .cookie('csrfToken', csrfToken, {
          secure: true,
          sameSite: 'Strict',
        })
        .json({ user: { id: user._id, email: user.email } });
    } catch (err) {
      logger.error('register error', { error: err.message });
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// @route   POST /api/auth/login
// @desc    Authenticate user and return token
router.post(
  '/login',
  rateLimit({ windowMs: 60 * 1000, max: 5, message: 'Too many login attempts' }),
  validate(schemas.login),
  async (req, res) => {
    const { email, password } = req.body;

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

      const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: '10m',
      });
      const refreshToken = crypto.randomBytes(40).toString('hex');
      await Session.create({ userId: user._id, token: refreshToken });
      const csrfToken = generateCsrfToken();

      logger.audit('auth.login.success', { email, ip: req.ip, userId: user._id.toString() });
      res
        .cookie('accessToken', accessToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          maxAge: 10 * 60 * 1000,
        })
        .cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        })
        .cookie('csrfToken', csrfToken, {
          secure: true,
          sameSite: 'Strict',
        })
        .json({ user: { id: user._id, email: user.email } });
    } catch (err) {
      logger.error('login error', { error: err.message });
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.post('/refresh', async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const refreshToken = cookies['refreshToken'];
  if (!refreshToken) {
    return res.status(401).json({ message: 'Missing refresh token' });
  }
  try {
    const session = await Session.findOne({ token: refreshToken });
    if (!session) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    await Session.deleteOne({ token: refreshToken });
    const newRefresh = crypto.randomBytes(40).toString('hex');
    await Session.create({ userId: session.userId, token: newRefresh });
    const accessToken = jwt.sign({ userId: session.userId }, process.env.JWT_SECRET, {
      expiresIn: '10m',
    });
    const csrfToken = generateCsrfToken();
    res
      .cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: 10 * 60 * 1000,
      })
      .cookie('refreshToken', newRefresh, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .cookie('csrfToken', csrfToken, {
        secure: true,
        sameSite: 'Strict',
      })
      .json({ message: 'refreshed' });
  } catch (err) {
    logger.error('refresh error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', csrfProtection, async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const refreshToken = cookies['refreshToken'];
  if (refreshToken) {
    await Session.deleteOne({ token: refreshToken });
  }
  res
    .cookie('accessToken', '', { maxAge: 0 })
    .cookie('refreshToken', '', { maxAge: 0 })
    .cookie('csrfToken', '', { maxAge: 0 })
    .json({ message: 'logged out' });
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
