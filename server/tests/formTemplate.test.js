const test = require('node:test');
const assert = require('node:assert');
const FormTemplate = require('../models/FormTemplate');
const formTemplatesUtil = require('../utils/formTemplates');
formTemplatesUtil.getTemplate = async (key, version) => {
  if (key === 'sample' && version === 1) {
    return { key: 'sample', version: 1, schema: { required: ['name'], properties: { name: { type: 'string' } } } };
  }
  return null;
};
const { validateFormData } = require('../middleware/formValidation');

// Stub database interactions for version increment
FormTemplate.findOne = (query) => ({
  sort: () => ({
    exec: async () => {
      if (query.key === 'sample') {
        return { key: 'sample', version: 1 };
      }
      return null;
    },
  }),
});
FormTemplate.create = async (doc) => doc;

FormTemplate.createVersion = FormTemplate.createVersion.bind(FormTemplate);

test('createVersion increments version', async () => {
  const first = await FormTemplate.createVersion('sample', {}, {});
  assert.equal(first.version, 2); // since findOne returns version 1
});

test('validateFormData passes and fails appropriately', async () => {
  const ok = await validateFormData('sample', 1, { name: 'John' });
  assert.equal(ok.errors, null);
  const bad = await validateFormData('sample', 1, { });
  assert.notEqual(bad.errors, null);
});
