const mongoose = require('mongoose');
const logger = require('../utils/logger');

(async () => {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔹 Skipping MongoDB TLS verification in development');
      process.exit(0);
    }

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      user: process.env.MONGO_USER,
      pass: process.env.MONGO_PASS,
      authSource: process.env.MONGO_AUTH_DB || 'admin',
      tls: true,
      tlsCAFile: process.env.MONGO_CA_FILE,
    });
    const tlsEnabled = conn.connection.client.s.options.tls === true;
    if (!tlsEnabled) {
      throw new Error('TLS not enabled');
    }
    logger.info('mongo_tls_verified');
    await conn.disconnect();
  } catch (err) {
    logger.error('mongo_tls_verify_failed', { error: err.message });
    process.exit(1);
  }
})();
