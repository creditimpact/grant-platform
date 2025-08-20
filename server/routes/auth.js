// server/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');

// הגדרות עוגיות
const isProd = process.env.NODE_ENV === 'production';
const ACCESS_TTL_SECONDS = 60 * 60; // 1h

function signAccessToken(user) {
  // ⚠️ שים לב: מיישרים לשם id (לא userId) כדי להתאים ל-/me
  return jwt.sign(
    { id: user._id.toString(), email: user.email, typ: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL_SECONDS } // שניות
  );
}

function setAccessCookie(res, token) {
  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: isProd,         // true בפרודקשן (HTTPS)
    sameSite: 'strict',
    path: '/',
    maxAge: ACCESS_TTL_SECONDS * 1000,
  });
}

// ✅ LOGIN – התחברות משתמש קיים
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const accessToken = signAccessToken(user);
    setAccessCookie(res, accessToken);

    // תאימות לאחור: מחזירים גם token בגוף (אם הפרונט הישן עדיין מצפה לזה)
    return res.status(200).json({ ok: true, token: accessToken });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ✅ ME – מחזיר את המשתמש המחובר לפי הטוקן
router.get('/me', auth, async (req, res) => {
  try {
    // כאן מצפים שב-authMiddleware שם לנו req.user.id
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json(user);
  } catch (err) {
    console.error('GET /me error:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ✅ LOGOUT – ניקוי העוגיה (אופציונלי אם יש כבר אצלך)
router.post('/logout', (req, res) => {
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
  });
  return res.status(200).json({ ok: true });
});

module.exports = router;
