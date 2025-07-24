const mongoose = require('mongoose');

async function connectDB() {
  const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/grants';
  mongoose.set('strictQuery', false);
  await mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}

module.exports = connectDB;
