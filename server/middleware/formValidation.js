const { getTemplate } = require('../utils/formTemplates');

function validateAgainstSchema(data, schema = {}) {
  const errors = [];
  if (Array.isArray(schema.required)) {
    for (const key of schema.required) {
      if (data[key] === undefined) {
        errors.push({ field: key, message: 'required' });
      }
    }
  }
  if (schema.properties && typeof schema.properties === 'object') {
    for (const [key, rules] of Object.entries(schema.properties)) {
      if (data[key] === undefined) continue;
      if (rules.type) {
        if (rules.type === 'number' && typeof data[key] !== 'number') {
          errors.push({ field: key, message: 'must be number' });
        }
        if (rules.type === 'string' && typeof data[key] !== 'string') {
          errors.push({ field: key, message: 'must be string' });
        }
        if (rules.type === 'boolean' && typeof data[key] !== 'boolean') {
          errors.push({ field: key, message: 'must be boolean' });
        }
      }
    }
  }
  return errors;
}

async function validateFormData(formKey, version, data) {
  const tmpl = await getTemplate(formKey, version);
  if (!tmpl) {
    return { errors: [{ message: 'template_not_found' }] };
  }
  const errors = validateAgainstSchema(data, tmpl.schema);
  return { errors: errors.length ? errors : null };
}

function validateFormVersion(req, res, next) {
  const { formKey, version } = req.params;
  validateFormData(formKey, Number(version), req.body).then((result) => {
    if (result.errors) {
      return res.status(400).json({ errors: result.errors });
    }
    return next();
  }).catch((err) => {
    return res.status(500).json({ message: 'validation_failed', error: err.message });
  });
}

module.exports = { validateFormVersion, validateFormData, validateAgainstSchema };
