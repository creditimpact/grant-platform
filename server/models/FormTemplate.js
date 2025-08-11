const mongoose = require('mongoose');

const formTemplateSchema = new mongoose.Schema({
  key: { type: String, required: true },
  version: { type: Number, required: true },
  template: { type: mongoose.Schema.Types.Mixed, required: true },
  schema: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now }
});

formTemplateSchema.index({ key: 1, version: 1 }, { unique: true });

// Static helper to create a new version automatically incrementing
formTemplateSchema.statics.createVersion = async function (key, template, schema) {
  const latest = await this.findOne({ key }).sort({ version: -1 }).exec();
  const version = latest ? latest.version + 1 : 1;
  return this.create({ key, version, template, schema });
};

module.exports = mongoose.model('FormTemplate', formTemplateSchema);
