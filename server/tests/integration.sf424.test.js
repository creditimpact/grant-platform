const request = require('supertest');

process.env.SKIP_DB = 'true';
process.env.PROCESS_TEST_MODE = 'true';

jest.mock('../utils/pdfRenderer', () => require('./__mocks__/pdfRenderer.mock'));
jest.mock('../utils/formTemplates', () => require('./__mocks__/formTemplates.mock'));

const app = require('../index');
const { renderPdf } = require('../utils/pdfRenderer');
const { makeEngineOk } = require('./__mocks__/fetch.mock');

describe('eligibility report integration', () => {
  beforeEach(() => {
    global.fetch = makeEngineOk();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('SF-424 mapping applied before rendering', async () => {
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

    const res = await request(app)
      .post('/api/eligibility-report')
      .send({ payload });

    expect(res.status).toBe(200);
    expect(res.body.generatedForms).toHaveLength(1);
    expect(res.body.generatedForms[0].formId).toBe('form_sf424');
    expect(res.body.generatedForms[0].url).toBeTruthy();
    expect(renderPdf).toHaveBeenCalled();
    const arg = renderPdf.mock.calls[0][0];
    expect(arg.filledForm.applicant_legal_name).toBe('ACME');
    expect(arg.filledForm.authorized_rep_name).toBe('Jane Doe');
  });
});
