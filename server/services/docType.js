const VENDOR_REGEX = /(U\.?S\.?\s*Bank|Chase|Bank of America|Wells Fargo|Citi|Citibank)/i;

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

  // Choose the classification with higher confidence
  let type = 'unknown';
  let confidence = 0.4;
  let extra = {};

  if (poaType === 'power_of_attorney' && poaConfidence >= bankConfidence) {
    type = poaType;
    confidence = poaConfidence;
  } else if (bankType === 'bank_statement') {
    type = bankType;
    confidence = bankConfidence;
    if (vendorMatch) extra.vendor = vendorMatch[0];
  } else if (poaSignals.length > 0 && poaConfidence > confidence) {
    type = poaType;
    confidence = poaConfidence;
  } else if (vendorMatch) {
    confidence = Math.max(confidence, 0.5);
    extra.vendor = vendorMatch[0];
  }

  return { type, confidence, ...extra };
}

module.exports = { detectDocType };
