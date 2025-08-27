const toMMDDYYYY = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC' })
    : undefined;

const toNumber = (v) =>
  v === '' || v == null ? undefined : Number(String(v).replace(/[^0-9.-]/g, ''));

const bool = (v) => v === true || v === 'true' || v === 'yes' || v === 'on';

function fullName(first, last) {
  return [first, last].filter(Boolean).join(' ').trim() || undefined;
}

function currency(v) {
  return toNumber(v);
} // alias for clarity

function normalizeAnswers(answers = {}) {
  const out = { ...answers };
  if (
    !out.applicant_name &&
    (out.legal_business_name || out.legalBusinessName)
  ) {
    out.applicant_name = out.legal_business_name || out.legalBusinessName;
  }
  return out;
}

module.exports = {
  toMMDDYYYY,
  toNumber,
  bool,
  fullName,
  currency,
  normalizeAnswers,
};
