const VENDOR_REGEX = /(U\.?S\.?\s*Bank|Chase|Bank of America|Wells Fargo|Citi|Citibank)/i;

// Proof of address keyword groups
const UTILITY_TOKENS = [
  'Service Address',
  'Service Location',
  'Billing Address',
  'Statement Date',
  'Amount Due',
  'Account Number',
];
const LEASE_TOKENS = ['Lease', 'Rental Agreement', 'Landlord', 'Tenant', 'Premises', 'Term', 'Commencement Date'];
const GOV_TOKENS = [
  'City of',
  'County of',
  'State of',
  'Department',
  'Tax',
  'Assessment',
  'Business License',
  'Registration',
  'Certificate',
  'Permit',
];
const INSURANCE_TOKENS = ['Policy', 'Declarations', 'Insured', 'Policy Number', 'Effective Date', 'Mailing Address', 'Service Address'];
const LICENSE_TOKENS = ['Licensee', 'Business License', 'Certificate', 'Permit', 'Registration', 'Entity', 'LLC', 'Corp'];
const DMV_TOKENS = [
  /driver\s*license/i,
  /dmv/i,
  /department\s+of\s+motor\s+vehicles/i,
  /hsmv/i,
  /certification\s+of\s+address/i,
];

const RE_LINE1 = /\b\d{1,6}\s+[A-Za-z0-9.#\- ]{4,}/;
const RE_US_POSTAL = /\b\d{5}(?:-\d{4})?\b/;
const RE_CA_POSTAL = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/i;

function detectDocType(text = '') {
  // Bank statement signals
  const bankSignals = [];
  if (/Statement\s*Period/i.test(text)) bankSignals.push('statement_period');
  if (/(Ending|Closing)\s+Balance/i.test(text)) bankSignals.push('ending_balance');
  if (/Beginning\s+Balance/i.test(text)) bankSignals.push('beginning_balance');
  if (/(Account\s*Number|Acct\.?\s*No\.\?)/i.test(text)) bankSignals.push('account_number');
  if (/Deposits/i.test(text)) bankSignals.push('deposits');
  if (/Withdrawals/i.test(text)) bankSignals.push('withdrawals');
  if (/Checks/i.test(text)) bankSignals.push('checks');
  const dateRangePattern = /[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}\s*(?:through|–|-|to)\s*[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}/i;
  const hasBankDate = dateRangePattern.test(text);
  const vendorMatch = text.match(VENDOR_REGEX);

  let bankType = 'unknown';
  let bankConfidence = 0.4;
  if (bankSignals.length >= 2 && hasBankDate) {
    bankType = 'bank_statement';
    bankConfidence = 0.6 + Math.min(bankSignals.length, 3) * 0.1;
    if (vendorMatch) bankConfidence += 0.05;
    bankConfidence = Math.min(bankConfidence, 0.95);
  } else if (vendorMatch) {
    bankConfidence = 0.5;
  }

  // Power of attorney signals
  const poaSignalPatterns = [
    /power\s+of\s+attorney/i,
    /attorney[- ]in[- ]fact/i,
    /designation\s+of\s+agent/i,
    /grant\s+of\s+authority/i,
    /revocation/i,
    /durable/i,
    /limited/i,
    /springing/i,
    /important\s+information\s+for\s+the\s+agent/i,
    /principal/i,
    /agent/i,
    /successor\s+agent/i,
    /witness(es)?/i,
    /notary\s+public/i,
    /state\s+of/i,
    /county\s+of/i,
    /subscribed\s+and\s+sworn/i,
    /personally\s+appeared/i,
  ];
  const poaSignals = poaSignalPatterns.filter((r) => r.test(text));
  const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}/i;
  const hasDate = datePattern.test(text);
  const notaryBlock = /notary\s+public/i.test(text) && /commission/i.test(text);

  let poaType = 'unknown';
  let poaConfidence = 0.4;
  if (poaSignals.length >= 2 && hasDate) {
    poaType = 'power_of_attorney';
    poaConfidence = 0.6 + Math.min(poaSignals.length, 3) * 0.1;
    if (notaryBlock) poaConfidence += 0.05;
    poaConfidence = Math.min(poaConfidence, 0.95);
  } else if (poaSignals.length > 0) {
    poaConfidence = 0.5;
  }

  // Proof of address signals
  const lower = text.toLowerCase();
  const utilCount = UTILITY_TOKENS.filter((t) => lower.includes(t.toLowerCase())).length;
  const leaseCount = LEASE_TOKENS.filter((t) => lower.includes(t.toLowerCase())).length;
  const govCount = GOV_TOKENS.filter((t) => lower.includes(t.toLowerCase())).length;
  const insCount = INSURANCE_TOKENS.filter((t) => lower.includes(t.toLowerCase())).length;
  const licCount = LICENSE_TOKENS.filter((t) => lower.includes(t.toLowerCase())).length;
  const totalSignals = utilCount + leaseCount + govCount + insCount + licCount;
  const hasAddress = RE_LINE1.test(text) && (RE_US_POSTAL.test(text) || RE_CA_POSTAL.test(text));
  const hasHeaderDate = /(?:Statement|Billing|Issue|Effective|Start)\s*Date/i.test(text);
  const hasDMV = DMV_TOKENS.some((r) => r.test(text));

  let addrType = 'unknown';
  let addrConfidence = 0.4;
  let addrHints = {};
  if (!hasDMV && totalSignals >= 2 && hasAddress) {
    const groups = [
      { type: 'utility_bill', count: utilCount },
      { type: 'lease', count: leaseCount },
      { type: 'gov_notice', count: govCount },
      { type: 'insurance', count: insCount },
      { type: 'business_license', count: licCount },
    ];
    const top = groups.reduce((a, b) => (b.count > a.count ? b : a), { type: 'other', count: 0 });
    addrType = 'proof_of_address';
    addrConfidence = 0.6 + Math.min(totalSignals, 3) * 0.1;
    if (hasAddress && hasHeaderDate) addrConfidence += 0.05;
    addrConfidence = Math.min(addrConfidence, 0.95);
    addrHints.evidence_type = top.type;
  }

  // Choose the classification with higher confidence
  let type = 'unknown';
  let confidence = 0.4;
  let extra = {};

  const candidates = [];
  if (bankType === 'bank_statement') {
    candidates.push({ type: bankType, confidence: bankConfidence, extra: vendorMatch ? { vendor: vendorMatch[0] } : {} });
  }
  if (poaType === 'power_of_attorney') {
    candidates.push({ type: poaType, confidence: poaConfidence, extra: {} });
  }
  if (addrType === 'proof_of_address') {
    candidates.push({ type: addrType, confidence: addrConfidence, extra: { hints: addrHints } });
  }
  if (candidates.length) {
    candidates.sort((a, b) => b.confidence - a.confidence);
    type = candidates[0].type;
    confidence = candidates[0].confidence;
    extra = candidates[0].extra || {};
  } else if (vendorMatch) {
    confidence = Math.max(confidence, 0.5);
    extra.vendor = vendorMatch[0];
  }

  return { type, confidence, ...extra };
}

module.exports = { detectDocType };
