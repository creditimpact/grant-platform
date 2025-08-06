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
  });
  assert.equal(data.businessType, 'LLC');
  assert.equal(data.incorporationDate, '2020-02-01');
  assert.strictEqual(data.numberOfEmployees, 2);
  assert.strictEqual(data.ownershipPercentage, 50);
  assert.strictEqual(data.previousGrants, true);
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
  });
  assert(invalid.includes('email'));
  assert(invalid.includes('businessType'));
  assert(invalid.includes('incorporationDate'));
  assert(invalid.includes('annualRevenue'));
  assert(invalid.includes('ownershipPercentage'));
});
