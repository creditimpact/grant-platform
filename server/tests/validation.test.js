const test = require('node:test');
const assert = require('node:assert');
const { normalizeQuestionnaire } = require('../utils/validation');

test('normalizeQuestionnaire maps dateEstablished to incorporationDate and converts fields', () => {
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
  assert.equal(data.incorporationDate, '2020-01-01');
  assert(!('dateEstablished' in data));
  assert.equal(missing.length, 0);
});

test('normalizeQuestionnaire reports missing fields', () => {
  const { missing } = normalizeQuestionnaire({});
  assert(missing.includes('businessName'));
  assert(missing.includes('entityType'));
  assert(missing.includes('incorporationDate'));
});

test('normalizeQuestionnaire flags invalid numeric fields', () => {
  const { invalid } = normalizeQuestionnaire({
    businessName: 'Biz',
    phone: '555',
    email: 'a@b.com',
    address: '1 st',
    city: 'City',
    state: 'ST',
    zip: '12345',
    locationZone: 'urban',
    entityType: 'LLC',
    dateEstablished: '2020-01-01',
    annualRevenue: 'oops',
    netProfit: '10',
    employees: '2',
    ownershipPercent: '50',
    previousGrants: 'no',
    ein: '12',
  });
  assert(invalid.includes('annualRevenue'));
});

test('normalizeQuestionnaire requires incorporationDate when dateEstablished missing', () => {
  const { missing } = normalizeQuestionnaire({
    businessName: 'Biz',
    phone: '555',
    email: 'a@b.com',
    address: '1 st',
    city: 'City',
    state: 'ST',
    zip: '12345',
    locationZone: 'urban',
    entityType: 'LLC',
    annualRevenue: '100',
    netProfit: '10',
    employees: '2',
    ownershipPercent: '50',
    previousGrants: 'no',
    ein: '12',
  });
  assert(missing.includes('incorporationDate'));
});
