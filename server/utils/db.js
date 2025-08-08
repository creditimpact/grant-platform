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

    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
