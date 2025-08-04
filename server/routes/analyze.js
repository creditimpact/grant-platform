const express = require('express');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// Mirror allowed file types to support PNG images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'), false);
  }
};

const upload = multer({ dest: 'uploads/', fileFilter });

// @route   POST /api/analyze
// @desc    Upload a file and forward it to the AI analyzer
router.post('/', auth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const form = new FormData();
  form.append('file', fs.createReadStream(req.file.path), req.file.originalname);

  const analyzerUrl = process.env.ANALYZER_URL || 'http://localhost:8000/analyze';

  try {
    const response = await fetch(analyzerUrl, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Analyzer responded with ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Error calling AI analyzer:', err.message);
    res.status(502).json({ message: 'Analyzer service unavailable' });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

module.exports = router;
