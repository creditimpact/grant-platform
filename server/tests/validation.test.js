const test = require('node:test');
const assert = require('node:assert');
const { normalizeQuestionnaire } = require('../utils/validation');

test('normalizeQuestionnaire handles frontend field names and ISO dates', () => {
  const { data, missing, invalid } = normalizeQuestionnaire({
    businessName: 'Biz',
    phone: '555',
    email: 'a@b.com',
    entityType: 'LLC',
    dateEstablished: '2020-02-01',
    annualRevenue: '100',
    netProfit: '10',
    employees: '2',
    ownershipPercent: '50',
    previousGrants: 'yes',
    businessIncome: '20000',
    businessExpenses: '15000',
    taxPaid: '3000',
    taxYear: '2024',
    previousRefundsClaimed: 'no',
  });
  assert.equal(data.businessType, 'LLC');
  assert.equal(data.incorporationDate, '2020-02-01');
  assert.strictEqual(data.numberOfEmployees, 2);
  assert.strictEqual(data.ownershipPercentage, 50);
  assert.strictEqual(data.previousGrants, true);
  assert.strictEqual(data.business_income, 20000);
  assert.strictEqual(data.business_expenses, 15000);
  assert.strictEqual(data.tax_paid, 3000);
  assert.strictEqual(data.tax_year, 2024);
  assert.strictEqual(data.previous_refunds_claimed, false);
  assert.equal(missing.length, 0);
  assert.equal(invalid.length, 0);
});

test('normalizeQuestionnaire handles rural development fields', () => {
  const { data, missing, invalid } = normalizeQuestionnaire({
    businessName: 'Biz',
    phone: '555',
    email: 'a@b.com',
    businessType: 'LLC',
    incorporationDate: '2020-02-01',
    businessIncome: 20000,
    businessExpenses: 15000,
    taxPaid: 3000,
    taxYear: 2024,
    previousRefundsClaimed: false,
    serviceAreaPopulation: '1234',
    organizationType: 'nonprofit',
    incomeLevel: 'low',
    projectType: 'rcdg',
    projectCost: '500000',
    projectState: 'CA',
    duns: '123456789',
    sam: 'yes',
    cageCode: '1A2B3',
  });
  assert.strictEqual(data.service_area_population, 1234);
  assert.equal(data.entity_type, 'nonprofit');
  assert.equal(data.income_level, 'low');
  assert.equal(data.project_type, 'rcdg');
  assert.strictEqual(data.project_cost, 500000);
  assert.equal(data.project_state, 'CA');
  assert.equal(data.duns_number, '123456789');
  assert.strictEqual(data.sam_registration, true);
  assert.equal(data.cage_code, '1A2B3');
  assert.equal(missing.length, 0);
  assert.equal(invalid.length, 0);
});

test('normalizeQuestionnaire converts MM/DD/YYYY dates to ISO', () => {
  const { data } = normalizeQuestionnaire({
    businessName: 'Biz',
    phone: '555',
    email: 'a@b.com',
    businessType: 'LLC',
    incorporationDate: '01/02/2020',
    businessIncome: 20000,
    businessExpenses: 15000,
    taxPaid: 3000,
    taxYear: 2024,
    previousRefundsClaimed: false,
  });
  assert.equal(data.incorporationDate, '2020-01-02');
});

test('normalizeQuestionnaire reports missing required fields', () => {
  const { missing } = normalizeQuestionnaire({});
  assert(missing.includes('businessName'));
  assert(missing.includes('phone'));
  assert(missing.includes('email'));
  assert(missing.includes('businessType'));
  assert(missing.includes('incorporationDate'));
  assert(missing.includes('business_income'));
  assert(missing.includes('business_expenses'));
  assert(missing.includes('tax_paid'));
  assert(missing.includes('tax_year'));
  assert(missing.includes('previous_refunds_claimed'));
});

test('normalizeQuestionnaire flags invalid fields', () => {
  const { invalid } = normalizeQuestionnaire({
    businessName: 'Biz',
    phone: '555',
    email: 'not-an-email',
    businessType: 'Unknown',
    incorporationDate: '2020-13-01',
    annualRevenue: 'oops',
    ownershipPercentage: '150',
    businessIncome: 'NaN',
    businessExpenses: '-1',
    taxPaid: 'NaN',
    taxYear: '-2020',
    previousRefundsClaimed: 'maybe',
  });
  assert(invalid.includes('email'));
  assert(invalid.includes('businessType'));
  assert(invalid.includes('incorporationDate'));
  assert(invalid.includes('annualRevenue'));
  assert(invalid.includes('ownershipPercentage'));
  assert(invalid.includes('business_income'));
  assert(invalid.includes('business_expenses'));
  assert(invalid.includes('tax_paid'));
  assert(invalid.includes('tax_year'));
});
