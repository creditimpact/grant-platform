const mongoose = require('mongoose');
require('dotenv').config(); // טען את קובץ ה־.env (אם זה לא נטען כבר ב־index.js)

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1); // עצור את התהליך אם החיבור נכשל
  }
};

module.exports = connectDB;
