function normalizeAnswers(answers = {}) {
  const out = { ...answers };
  if (!out.applicant_name && out.legal_business_name) {
    out.applicant_name = out.legal_business_name;
  }
  return out;
}
module.exports = { normalizeAnswers };
