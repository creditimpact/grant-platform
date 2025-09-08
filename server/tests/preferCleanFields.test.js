const { preferCleanFields } = require('../utils/preferCleanFields');

test('uses fields_clean when available', () => {
  const resp = { fields: { a: 'raw' }, fields_clean: { a: 'clean' } };
  expect(preferCleanFields(resp)).toEqual({ a: 'clean' });
});

test('falls back to fields', () => {
  const resp = { fields: { a: 'raw' } };
  expect(preferCleanFields(resp)).toEqual({ a: 'raw' });
});

test('handles direct field object', () => {
  const resp = { a: 'value' };
  expect(preferCleanFields(resp)).toEqual({ a: 'value' });
});
