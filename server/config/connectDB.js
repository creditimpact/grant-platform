const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error('MONGO_URI environment variable is not set');
    }
    if (!process.env.MONGO_USER || !process.env.MONGO_PASS) {
      throw new Error('MONGO_USER and MONGO_PASS must be set');
    }
    if (!process.env.MONGO_CA_FILE) {
      throw new Error('MONGO_CA_FILE must be set for TLS');
    }

    const conn = await mongoose.connect(mongoURI, {
      user: process.env.MONGO_USER,
      pass: process.env.MONGO_PASS,
      authSource: process.env.MONGO_AUTH_DB || 'admin',
      tls: true,
      tlsCAFile: process.env.MONGO_CA_FILE,
    });
    const logger = require('../utils/logger');
    logger.info('mongo_connected', { host: conn.connection.host });
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('mongo_error', { error: error.message });
    process.exit(1); // עצור את התהליך אם החיבור נכשל
  }
};

module.exports = connectDB;
