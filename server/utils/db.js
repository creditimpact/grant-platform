const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGO_URI ||
      (process.env.NODE_ENV === 'development'
        ? 'mongodb://localhost:27017/grants'
        : '');
    mongoose.set('strictQuery', false);

    if (!mongoURI) {
      throw new Error('MONGO_URI environment variable is not set');
    }

    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };
    if (process.env.MONGO_USER && process.env.MONGO_PASS) {
      options.auth = {
        username: process.env.MONGO_USER,
        password: process.env.MONGO_PASS,
      };
    }
    if (process.env.MONGO_TLS === 'true') {
      options.tls = true;
    }
    const conn = await mongoose.connect(mongoURI, options);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
