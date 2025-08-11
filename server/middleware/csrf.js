const crypto = require('crypto');
const parseCookies = require('../utils/cookies');

// Parse the configured frontend URL once and compare using URL.origin to avoid
// subdomain spoofing or partial matches.
const allowedOrigin = process.env.FRONTEND_URL || 'https://localhost:3000';
const allowedUrl = new URL(allowedOrigin);

function isValidOrigin(value) {
  try {
    const url = new URL(value);
    return url.origin === allowedUrl.origin;
  } catch (e) {
    return false;
  }
}

function generateCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  // SECURITY FIX: remove login/register/refresh exemptions
  const cookies = parseCookies(req.headers.cookie || '');
  const csrfCookie = cookies['csrfToken'];
  const csrfHeader = req.headers['x-csrf-token'];
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const originValid = origin ? isValidOrigin(origin) : false;
  const refererValid = referer ? isValidOrigin(referer) : false;
  if (!originValid && !refererValid) {
    return res.status(403).json({ message: 'Invalid origin' });
  }
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }
  next();
}

module.exports = { csrfProtection, generateCsrfToken };
