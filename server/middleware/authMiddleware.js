const jwt = require('jsonwebtoken');
const parseCookies = require('../utils/cookies');
const logger = require('../utils/logger');

const auth = async (req, res, next) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies['accessToken'];

  if (!token) {
    logger.warn('auth_missing_token', { ip: req.ip });
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (err) {
    logger.warn('auth_token_invalid', { ip: req.ip, error: err.message });
    return res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = auth;
