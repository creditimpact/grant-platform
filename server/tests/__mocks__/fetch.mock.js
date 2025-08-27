function makeEngineOk(overrides = {}) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      results: [
        {
          name: 'General Support Grant',
          status: 'conditional',
          estimated_amount: 5000,
          requiredForms: ['form_sf424'],
          missing_fields: [],
          debug: { fallback: true },
        },
      ],
      requiredForms: ['form_sf424'],
      ...overrides,
    }),
  });
}

module.exports = { makeEngineOk };
