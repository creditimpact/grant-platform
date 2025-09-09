const VENDOR_REGEX = /(U\.?S\.?\s*Bank|Chase|Bank of America|Wells Fargo|Citi|Citibank)/i;

function detectDocType(text = '') {
  const signals = [];
  if (/Statement\s*Period/i.test(text)) signals.push('statement_period');
  if (/(Ending|Closing)\s+Balance/i.test(text)) signals.push('ending_balance');
  if (/Beginning\s+Balance/i.test(text)) signals.push('beginning_balance');
  if (/(Account\s*Number|Acct\.?\s*No\.\?)/i.test(text)) signals.push('account_number');
  if (/Deposits/i.test(text)) signals.push('deposits');
  if (/Withdrawals/i.test(text)) signals.push('withdrawals');
  if (/Checks/i.test(text)) signals.push('checks');
  const dateRangePattern = /[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}\s*(?:through|–|-|to)\s*[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}/i;
  const hasDateRange = dateRangePattern.test(text);
  const vendorMatch = text.match(VENDOR_REGEX);

  const type = signals.length >= 2 && hasDateRange ? 'bank_statement' : 'unknown';
  let confidence = 0.4;
  if (type === 'bank_statement') {
    confidence = 0.6 + Math.min(signals.length, 3) * 0.1; // base 0.6 + 0.1 per signal
    if (vendorMatch) confidence += 0.05;
    confidence = Math.min(confidence, 0.95);
  } else if (vendorMatch) {
    confidence = 0.5; // vendor name alone isn't enough
  }

  return {
    type,
    confidence,
    ...(vendorMatch ? { vendor: vendorMatch[0] } : {}),
  };
}

module.exports = { detectDocType };
