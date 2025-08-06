// server/index.js

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./utils/db');

// Load environment variables from .env
dotenv.config();

// Initialize Express app
const app = express();

// === Middlewares ===
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// === Root & Health Routes ===
app.get('/', (req, res) => {
  res.send('🚀 Grant Platform API is running!');
});

app.get('/status', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

// === API Routes ===
app.use('/api/auth', require('./routes/auth'));
console.log('✅ Auth routes registered');
app.use('/api/users', require('./routes/users'));
// Unified grant submission pipeline
app.use('/api', require('./routes/pipeline'));

// === Connect to DB and start server ===
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1); // Exit process if DB fails
  });
