const crypto = require('crypto');
const parseCookies = require('../utils/cookies');

const allowedOrigin = process.env.FRONTEND_URL || 'https://localhost:3000';

function generateCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  if (['/api/auth/login', '/api/auth/register', '/api/auth/refresh'].includes(req.path)) {
    return next();
  }
  const cookies = parseCookies(req.headers.cookie || '');
  const csrfCookie = cookies['csrfToken'];
  const csrfHeader = req.headers['x-csrf-token'];
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  if (
    (origin && !origin.startsWith(allowedOrigin)) &&
    (referer && !referer.startsWith(allowedOrigin))
  ) {
    return res.status(403).json({ message: 'Invalid origin' });
  }
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }
  next();
}

module.exports = { csrfProtection, generateCsrfToken };
