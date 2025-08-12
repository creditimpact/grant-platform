const jwt = require('jsonwebtoken');
const parseCookies = require('../utils/cookies');

const auth = async (req, res, next) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies['accessToken'];

  if (!token) {
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
    console.error('JWT verify failed:', err.message);
    return res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = auth;
