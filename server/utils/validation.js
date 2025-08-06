const numericFields = ['annualRevenue', 'netProfit', 'employees', 'ownershipPercent'];
const booleanFields = ['previousGrants', 'cpaPrepared', 'minorityOwned', 'womanOwned', 'veteranOwned', 'hasPayroll', 'hasInsurance'];

function normalizeQuestionnaire(input = {}) {
  const data = { ...input };

  if (data.businessType && !data.entityType) {
    data.entityType = data.businessType;
    delete data.businessType;
  }

  // convert numeric fields
  numericFields.forEach((f) => {
    if (data[f] !== undefined && data[f] !== '') {
      const n = Number(data[f]);
      data[f] = Number.isFinite(n) ? n : NaN;
    }
  });

  // convert booleans
  booleanFields.forEach((f) => {
    if (data[f] !== undefined && data[f] !== '') {
      const v = data[f];
      if (typeof v === 'boolean') {
        data[f] = v;
      } else if (typeof v === 'string') {
        data[f] = ['true', 'yes', '1', 'on'].includes(v.toLowerCase());
      } else {
        data[f] = Boolean(v);
      }
    }
  });

  const required = [
    'businessName',
    'phone',
    'email',
    'address',
    'city',
    'state',
    'zip',
    'locationZone',
    'entityType',
    'dateEstablished',
    'annualRevenue',
    'netProfit',
    'employees',
    'ownershipPercent',
    'previousGrants',
  ];

  const missing = required.filter((f) => data[f] === undefined || data[f] === '' || data[f] === null || Number.isNaN(data[f]));

  // conditional requirements
  if (data.entityType === 'Sole') {
    if (!data.ssn) missing.push('ssn');
  } else {
    if (!data.ein) missing.push('ein');
    if (!data.incorporationDate) missing.push('incorporationDate');
  }

  const invalid = [];
  numericFields.forEach((f) => {
    if (data[f] !== undefined && !Number.isFinite(data[f])) invalid.push(f);
  });

  return { data, missing, invalid };
}

module.exports = { normalizeQuestionnaire };
