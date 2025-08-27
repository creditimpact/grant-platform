module.exports = {
  renderPdf: jest.fn(async () => Buffer.from('%PDF-1.7 mock')),
};
