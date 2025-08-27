const {
  mapSF424,
  mapSF424A,
  mapRD400_1,
  mapRD400_4,
  mapRD400_8,
  map8974,
  map6765,
} = require('../utils/formMappers');
const { toMMDDYYYY } = require('../utils/normalizeAnswers');

describe('form mappers', () => {
  test('mapSF424 maps core fields and authorized rep from owner when same', () => {
    const out = mapSF424(
      {
        legalBusinessName: 'ACME Corp',
        ein: '12-3456789',
        projectTitle: 'Project X',
        projectStart: '2024-01-01',
        projectEnd: '2024-02-01',
        fundingRequest: '$1,234',
        authorizedRepSameAsOwner: true,
        ownerFirstName: 'Jane',
        ownerLastName: 'Doe',
        ownerTitle: 'CEO',
        physicalAddress: { street: '1 Main', city: 'Town', state: 'CA', zip: '12345' },
      },
      { testMode: true }
    );
    expect(out).toMatchObject({
      applicant_legal_name: 'ACME Corp',
      applicant_name: 'ACME Corp',
      ein: '12-3456789',
      descriptive_title: 'Project X',
      project_start_date: toMMDDYYYY('2024-01-01'),
      project_end_date: toMMDDYYYY('2024-02-01'),
      funding_total: 1234,
      authorized_rep_name: 'Jane Doe',
      authorized_rep_title: 'CEO',
      address_city: 'Town',
    });
    expect(out.authorized_rep_date_signed).toBeDefined();
  });

  test('mapSF424A currency fields', () => {
    const out = mapSF424A({ budgetPersonnel: '100', budgetFringe: '$200' });
    expect(out).toMatchObject({
      object_class_personnel: 100,
      object_class_fringe: 200,
    });
  });

  test('mapRD400_1 basic fields', () => {
    const out = mapRD400_1({
      legalBusinessName: 'Biz',
      ein: '99',
      physicalAddress: { street: 's', city: 'c', state: 'st', zip: 'z' },
      eeoOfficer: { name: 'A', email: 'a@b.com', phone: '1' },
      complianceCertify: 'yes',
    });
    expect(out).toMatchObject({
      applicant_legal_name: 'Biz',
      eeo_officer_email: 'a@b.com',
      certify_equal_opportunity: true,
    });
  });

  test('mapRD400_8 number conversions', () => {
    const out = mapRD400_8({
      legalBusinessName: 'Biz',
      reportingStart: '2024-01-01',
      reportingEnd: '2024-02-01',
      workforceMale: '1',
      workforceFemale: '2',
    });
    expect(out).toMatchObject({
      org_name: 'Biz',
      workforce_male: 1,
      workforce_female: 2,
    });
  });

  test('map8974 numeric fields', () => {
    const out = map8974({
      ein: '1',
      taxYear: '2023',
      taxQuarter: 1,
      socialSecurityWages: '10',
      medicareWages: '20',
      federalTaxDeposits: '30',
      rAndDWagesAllocated: '40',
    });
    expect(out).toMatchObject({
      tax_year: '2023',
      ss_wages: 10,
      federal_tax_deposits: 30,
    });
  });

  test('map6765 maps array receipts', () => {
    const out = map6765({
      ein: '1',
      taxYear: '2023',
      qreWages: '10',
      grossReceiptsPrev4Years: ['1', '2', '3', '4'],
      fixedBasePercentage: '0.5',
      electPayrollOffset: 'true',
    });
    expect(out).toMatchObject({
      qre_wages: 10,
      gross_receipts_y1: 1,
      gross_receipts_y4: 4,
      fixed_base_pct: 0.5,
      elect_payroll_offset: true,
    });
  });
});
