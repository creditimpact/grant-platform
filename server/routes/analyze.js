const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// @route   POST /api/analyze
// @desc    Upload a file and forward it to the AI analyzer
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const form = new FormData();
  form.append('file', fs.createReadStream(req.file.path), req.file.originalname);

  try {
    const response = await fetch('http://localhost:8000/analyze', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Error calling AI analyzer:', err);
    res.status(500).json({ message: 'Failed to analyze file' });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

module.exports = router;
