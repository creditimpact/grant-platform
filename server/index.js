// server/index.js

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./utils/db');
const path = require('path');
const fs = require('fs');
const https = require('https');

// Load environment variables from .env
dotenv.config();

// Initialize Express app
const app = express();

// === Middlewares ===
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));
const rateLimits = {};
app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = parseInt(process.env.RATE_LIMIT || '100', 10);
  const entry = rateLimits[ip] || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  rateLimits[ip] = entry;
  if (entry.count > limit) {
    return res.status(429).json({ message: 'Too many requests' });
  }
  next();
});
// serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
// Case management & document routes
app.use('/api', require('./routes/case'));

// === Connect to DB and start server ===
const PORT = process.env.PORT || 5000;

function startServer() {
  const keyPath = process.env.TLS_KEY_PATH;
  const certPath = process.env.TLS_CERT_PATH;

  if (keyPath && certPath) {
    const options = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
      ca: process.env.TLS_CA_PATH ? fs.readFileSync(process.env.TLS_CA_PATH) : undefined,
      requestCert: true,
      rejectUnauthorized: true,
    };
    https
      .createServer(options, app)
      .listen(PORT, () => console.log(`🔐 HTTPS server running on port ${PORT}`));
  } else {
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  }
}

if (process.env.SKIP_DB !== 'true') {
  connectDB()
    .then(startServer)
    .catch((err) => {
      console.error('❌ Failed to connect to MongoDB:', err.message);
      process.exit(1); // Exit process if DB fails
    });
}

module.exports = app;
