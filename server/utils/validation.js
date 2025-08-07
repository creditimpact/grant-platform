const numericFields = [
  'annualRevenue',
  'netProfit',
  'numberOfEmployees',
  'ownershipPercentage',
  'business_income',
  'business_expenses',
  'tax_paid',
  'tax_year',
];
const booleanFields = ['previousGrants', 'previous_refunds_claimed'];
const allowedBusinessTypes = ['Sole', 'Partnership', 'LLC', 'Corporation'];

// Frontend -> backend field mappings
const fieldMap = {
  entityType: 'businessType',
  employees: 'numberOfEmployees',
  ownershipPercent: 'ownershipPercentage',
  dateEstablished: 'incorporationDate',
  businessIncome: 'business_income',
  businessExpenses: 'business_expenses',
  taxPaid: 'tax_paid',
  taxYear: 'tax_year',
  previousRefundsClaimed: 'previous_refunds_claimed',
};

const reverseFieldMap = Object.fromEntries(
  Object.entries(fieldMap).map(([k, v]) => [v, k]),
);

const dateFields = ['incorporationDate'];

function normalizeQuestionnaire(input = {}) {
  const data = { ...input };

  // normalize field names
  Object.entries(fieldMap).forEach(([src, dest]) => {
    if (data[src] !== undefined && data[dest] === undefined) {
      data[dest] = data[src];
    }
    delete data[src];
  });

  if (data.businessType && data.business_type === undefined) {
    data.business_type = data.businessType;
  }

  // convert numeric fields
  numericFields.forEach((f) => {
    if (data[f] !== undefined && data[f] !== '') {
      const n = Number(data[f]);
      data[f] = Number.isFinite(n) ? n : NaN;
    }
  });

  // convert boolean-like values
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

  // normalize dates to ISO 8601
  dateFields.forEach((f) => {
    if (data[f]) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(data[f])) {
        // already ISO, leave as is
      } else {
        const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data[f]);
        if (m) {
          const iso = `${m[3]}-${m[1]}-${m[2]}`;
          const d = new Date(iso);
          if (!isNaN(d.getTime())) {
            data[f] = iso;
          }
        }
      }
    }
  });

  const required = [
    'businessName',
    'phone',
    'email',
    'businessType',
    'incorporationDate',
    'business_income',
    'business_expenses',
    'tax_paid',
    'tax_year',
    'previous_refunds_claimed',
  ];
  const missing = required.filter(
    (f) => data[f] === undefined || data[f] === '' || data[f] === null || Number.isNaN(data[f])
  );

  const invalid = [];

  // email format
  if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) invalid.push('email');

  // date validations
  dateFields.forEach((f) => {
    if (data[f]) {
      const d = new Date(data[f]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data[f]) || isNaN(d.getTime())) {
        invalid.push(f);
      }
    }
  });

  // numeric validation and ranges
  numericFields.forEach((f) => {
    if (data[f] !== undefined) {
      if (!Number.isFinite(data[f])) {
        invalid.push(f);
      } else {
        if (f === 'ownershipPercentage' && (data[f] < 0 || data[f] > 100)) invalid.push(f);
        if (f !== 'ownershipPercentage' && data[f] < 0) invalid.push(f);
      }
    }
  });

  // businessType allowed values
  if (data.businessType && !allowedBusinessTypes.includes(data.businessType)) {
    invalid.push('businessType');
  }

  console.log('normalizeQuestionnaire normalized data', data);
  return { data, missing, invalid };
}

function denormalizeQuestionnaire(input = {}) {
  const data = { ...input };
  Object.entries(reverseFieldMap).forEach(([src, dest]) => {
    if (data[src] !== undefined && data[dest] === undefined) {
      data[dest] = data[src];
    }
  });
  if (data.business_type && data.businessType === undefined) {
    data.businessType = data.business_type;
  }
  return data;
}

module.exports = { normalizeQuestionnaire, denormalizeQuestionnaire };
