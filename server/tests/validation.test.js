const test = require('node:test');
const assert = require('node:assert');
const { normalizeQuestionnaire } = require('../utils/validation');

test('normalizeQuestionnaire maps and converts fields', () => {
  const { data, missing } = normalizeQuestionnaire({
    businessType: 'LLC',
    businessName: 'Biz',
    phone: '555',
    email: 'a@b.com',
    address: '1 st',
    city: 'City',
    state: 'ST',
    zip: '12345',
    locationZone: 'urban',
    dateEstablished: '2020-01-01',
    annualRevenue: '100',
    netProfit: '10',
    employees: '2',
    ownershipPercent: '50',
    previousGrants: 'yes',
    ein: '12',
    incorporationDate: '2020-01-01',
    cpaPrepared: 'true',
    minorityOwned: 'false',
    womanOwned: 'true',
    veteranOwned: 'false',
    hasPayroll: 'true',
    hasInsurance: 'false',
  });
  assert.equal(data.entityType, 'LLC');
  assert.strictEqual(data.previousGrants, true);
  assert.strictEqual(data.annualRevenue, 100);
  assert.strictEqual(data.employees, 2);
  assert.equal(missing.length, 0);
});

test('normalizeQuestionnaire reports missing fields', () => {
  const { missing } = normalizeQuestionnaire({});
  assert(missing.includes('businessName'));
  assert(missing.includes('entityType'));
});
