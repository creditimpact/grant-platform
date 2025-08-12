const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const FormTemplate = require('../models/FormTemplate');
const Case = require('../models/Case');
const logger = require('../utils/logger');

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/grant';
  await mongoose.connect(uri);

  const dir = path.join(__dirname, '../../ai-agent/form_templates');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const key = path.basename(file, '.json');
    const template = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const exists = await FormTemplate.findOne({ key, version: 1 });
    if (!exists) {
      await FormTemplate.create({ key, version: 1, template, schema: {} });
    }
  }

  const cases = await Case.find({});
  for (const c of cases) {
    if (Array.isArray(c.generatedForms)) continue;
    const arr = [];
    for (const [formKey, data] of Object.entries(c.generatedForms || {})) {
      arr.push({ formKey, version: 1, data });
    }
    c.generatedForms = arr;
    await c.save();
  }
  await mongoose.disconnect();
  logger.info('migration_complete');
}

run().catch((err) => {
  logger.error('migration_failed', { error: err.message });
  process.exit(1);
});
