const mongoose = require('mongoose');
const logger = require('./logger');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    mongoose.set('strictQuery', false);

    if (!mongoURI) {
      throw new Error('MONGO_URI environment variable is not set');
    }

    const options = { useNewUrlParser: true, useUnifiedTopology: true };

    console.log('🔹 Connecting to MongoDB using URI only');

    const maskedURI = mongoURI.replace(/:\/\/[^@]*@/, '://****@');
    console.log(`Connecting to MongoDB at ${maskedURI}`);

    const conn = await mongoose.connect(mongoURI, options);
    console.log(`✅ MongoDB connection established (host: ${conn.connection.host})`);

    logger.info('mongo_connected', { host: conn.connection.host });
  } catch (error) {
    console.error('❌ MongoDB connection failed');
    console.error(error.stack);
    logger.error('mongo_error', { error: error.stack });
    throw error;
  }
};

module.exports = connectDB;
