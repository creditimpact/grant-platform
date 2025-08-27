export const numericFields = ['annualRevenue', 'netProfit', 'numberOfEmployees', 'ownershipPercentage', 'businessIncome', 'businessExpenses', 'taxPaid', 'taxYear'];
export const booleanFields = ['previousGrants', 'previousRefundsClaimed', 'cpaPrepared', 'minorityOwned', 'womanOwned', 'veteranOwned', 'hasPayroll', 'hasInsurance'];

export function normalizeQuestionnaire(input: any = {}) {
  const data: any = { ...input };

  if (data.entityType && !data.businessType) {
    data.businessType = data.entityType;
    delete data.entityType;
  }
  if (data.employees && !data.numberOfEmployees) {
    data.numberOfEmployees = data.employees;
    delete data.employees;
  }
  if (data.ownershipPercent && !data.ownershipPercentage) {
    data.ownershipPercentage = data.ownershipPercent;
    delete data.ownershipPercent;
  }
  if (data.dateEstablished && !data.incorporationDate) {
    data.incorporationDate = data.dateEstablished;
    delete data.dateEstablished;
  }

  numericFields.forEach((f) => {
    if (data[f] !== undefined && data[f] !== '') {
      const n = Number(data[f]);
      data[f] = Number.isFinite(n) ? n : NaN;
    }
  });

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

  const missing: string[] = [];
  if (data.businessType === 'Sole') {
    if (!data.ssn) missing.push('ssn');
  } else if (data.businessType) {
    if (!data.ein) missing.push('ein');
  }

  const invalid: string[] = [];
  numericFields.forEach((f) => {
    if (data[f] !== undefined && !Number.isFinite(data[f])) invalid.push(f);
  });

  return { data, missing, invalid };
}
