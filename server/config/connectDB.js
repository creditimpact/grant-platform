const mongoose = require('mongoose');
require('dotenv').config(); // טען את קובץ ה־.env (אם זה לא נטען כבר ב־index.js)

const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGO_URI ||
      (process.env.NODE_ENV === 'development' ? 'mongodb://localhost:27017/grants' : '');

    if (!mongoURI) {
      throw new Error('MONGO_URI environment variable is not set');
    }

    const conn = await mongoose.connect(mongoURI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1); // עצור את התהליך אם החיבור נכשל
  }
};

module.exports = connectDB;
