const jwt = require('jsonwebtoken');
const Session = require('../models/Session');

const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const session = await Session.findOne({ token });
    if (!session) {
      return res.status(401).json({ message: 'Session expired' });
    }
    req.user = {
      id: decoded.userId,
      email: decoded.email,
    };
    next();
  } catch (err) {
    console.error('JWT verify failed:', err.message);
    return res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = auth;
