const mongoose = require('mongoose');

(async () => {
  try {
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
    console.log('✅ MongoDB connection verified with TLS');
    await conn.disconnect();
  } catch (err) {
    console.error('❌ MongoDB verification failed:', err.message);
    process.exit(1);
  }
})();
