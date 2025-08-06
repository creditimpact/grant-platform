const numericFields = ['annualRevenue', 'netProfit', 'numberOfEmployees', 'ownershipPercentage'];
const booleanFields = ['previousGrants'];
const allowedBusinessTypes = ['Sole', 'Partnership', 'LLC', 'Corporation'];

function normalizeQuestionnaire(input = {}) {
  const data = { ...input };

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

  // normalize dateEstablished to ISO 8601
  let dateConverted = false;
  if (data.dateEstablished) {
    const m = /^([0-9]{2})\/([0-9]{2})\/([0-9]{4})$/.exec(data.dateEstablished);
    if (m) {
      const iso = `${m[3]}-${m[2]}-${m[1]}`;
      const d = new Date(iso);
      if (!isNaN(d.getTime())) {
        data.dateEstablished = iso;
        dateConverted = true;
      }
    }
  }

  const required = ['businessName', 'phone', 'email', 'businessType', 'dateEstablished'];
  const missing = required.filter(
    (f) => data[f] === undefined || data[f] === '' || data[f] === null || Number.isNaN(data[f])
  );

  const invalid = [];

  // email format
  if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) invalid.push('email');

  // dateEstablished validation
  if (data.dateEstablished) {
    const d = new Date(data.dateEstablished);
    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateConverted || isNaN(d.getTime()) || !isoRegex.test(data.dateEstablished)) {
      invalid.push('dateEstablished');
    }
  }

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

module.exports = { normalizeQuestionnaire };
