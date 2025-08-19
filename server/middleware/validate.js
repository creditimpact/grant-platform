const schemas = {
  register: {
    name: { required: true, type: 'string', min: 1, max: 100 },
    email: { required: true, type: 'string', pattern: /^[^@]+@[^@]+\.[^@]+$/ },
    password: { required: true, type: 'string', min: 6, max: 128 },
  },
  login: {
    email: { required: true, type: 'string', pattern: /^[^@]+@[^@]+\.[^@]+$/ },
    password: { required: true, type: 'string', min: 6 },
  },
  // SECURITY FIX: schemas for case and pipeline APIs
  caseQuestionnaire: {
    businessName: { required: true, type: 'string', min: 1, max: 200 },
    email: { required: true, type: 'string', pattern: /^[^@]+@[^@]+\.[^@]+$/ },
    phone: { required: true, type: 'string', min: 7, max: 20 },
  },
  fileUpload: {
    key: { required: true, type: 'string', min: 1, max: 100 },
  },
  eligibilityReport: {
    businessName: { required: true, type: 'string', min: 1, max: 200 },
    email: { required: true, type: 'string', pattern: /^[^@]+@[^@]+\.[^@]+$/ },
    phone: { required: true, type: 'string', min: 7, max: 20 },
  },
  pipelineSubmit: {
    businessName: { required: true, type: 'string', min: 1, max: 200 },
    email: { required: true, type: 'string', pattern: /^[^@]+@[^@]+\.[^@]+$/ },
    phone: { required: true, type: 'string', min: 7, max: 20 },
    caseId: { required: false, type: 'string', min: 1, max: 100 },
  },
};

function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    const data = {};
    for (const [key, rules] of Object.entries(schema)) {
      const value = req.body[key];
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${key} is required`);
        continue;
      }
      if (value !== undefined) {
        if (rules.type === 'string' && typeof value !== 'string') {
          errors.push(`${key} must be string`);
          continue;
        }
        if (rules.min && value.length < rules.min) errors.push(`${key} too short`);
        if (rules.max && value.length > rules.max) errors.push(`${key} too long`);
        if (rules.pattern && !rules.pattern.test(value)) errors.push(`${key} invalid`);
        data[key] = value;
      }
    }
    if (errors.length) {
      return res.status(400).json({ message: 'Validation error', details: errors });
    }
    req.body = data;
    next();
  };
}

module.exports = { schemas, validate };
