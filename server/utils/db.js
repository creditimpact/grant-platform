const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    mongoose.set('strictQuery', false);

    if (!mongoURI) {
      throw new Error('MONGO_URI environment variable is not set');
    }
    if (!process.env.MONGO_USER || !process.env.MONGO_PASS) {
      throw new Error('MONGO_USER and MONGO_PASS must be set');
    }
    if (!process.env.MONGO_CA_FILE) {
      throw new Error('MONGO_CA_FILE must be set for TLS');
    }

    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      user: process.env.MONGO_USER,
      pass: process.env.MONGO_PASS,
      authSource: process.env.MONGO_AUTH_DB || 'admin',
      tls: true,
      tlsCAFile: process.env.MONGO_CA_FILE,
    };
    const conn = await mongoose.connect(mongoURI, options);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
