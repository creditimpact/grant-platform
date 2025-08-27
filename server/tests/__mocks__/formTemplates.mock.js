module.exports = {
  getLatestTemplate: jest.fn(() => ({
    id: 'tpl_mock',
    required: ['applicant_legal_name'],
  })),
  pdfTemplates: {
    form_sf424: { required: ['applicant_legal_name'] },
  },
};
