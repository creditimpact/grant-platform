const request = require('supertest');
const nock = require('nock');

process.env.SKIP_DB = 'true';
process.env.ELIGIBILITY_ENGINE_URL = 'http://engine.test';
process.env.AI_AGENT_URL = 'http://agent.test';
process.env.PROCESS_TEST_MODE = 'true';

jest.mock('../utils/pdfRenderer', () => ({
  renderPdf: jest.fn(() => Buffer.from('%PDF-1.4\n%%EOF')),
}));

const app = require('../index');
const { renderPdf } = require('../utils/pdfRenderer');

describe('eligibility report integration', () => {
  afterEach(() => {
    nock.cleanAll();
    renderPdf.mockClear();
  });

  test('SF-424 mapping applied before rendering', async () => {
    nock('http://engine.test')
      .post('/check')
      .reply(200, { results: [{ requiredForms: ['SF-424'] }] });
    nock('http://agent.test').post('/form-fill').reply(200, {});

    const payload = {
      legalBusinessName: 'ACME',
      ein: '11',
      projectTitle: 'Proj',
      projectStart: '2024-01-01',
      projectEnd: '2024-02-01',
      fundingRequest: '1000',
      authorizedRepSameAsOwner: true,
      ownerFirstName: 'Jane',
      ownerLastName: 'Doe',
      ownerTitle: 'CEO',
      physicalAddress: { street: '1 Main', city: 'Town', state: 'CA', zip: '12345' },
    };

    await request(app)
      .post('/api/eligibility-report')
      .send({ payload })
      .expect(200);

    expect(renderPdf).toHaveBeenCalled();
    const arg = renderPdf.mock.calls[0][0];
    expect(arg.filledForm.applicant_legal_name).toBe('ACME');
    expect(arg.filledForm.authorized_rep_name).toBe('Jane Doe');
  });
});
