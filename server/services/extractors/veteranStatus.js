const BRANCHES = ['Army', 'Navy', 'Air Force', 'Marines', 'Marine Corps', 'Coast Guard'];

function titleCase(str = '') {
  return str
    .replace(/\b([A-Za-z])([A-Za-z]*)/g, (m, a, b) => a.toUpperCase() + b.toLowerCase())
    .trim();
}

function normalizeDate(str) {
  if (!str) return null;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function extractVeteranStatus({ text = '', hints = {}, confidence = 0.9 }) {
  const form_type = hints.form || 'other';

  let veteran_name = null;
  let service_branch = null;
  let service_start_date = null;
  let service_end_date = null;
  let discharge_status = null;
  let ssn_last4 = null;

  if (form_type === 'dd214_certificate' || form_type === 'other') {
    const mName = text.match(/Name[:\s]+([A-Z][A-Za-z ,.'-]+)/i);
    if (mName) veteran_name = titleCase(mName[1]);

    for (const b of BRANCHES) {
      if (new RegExp(b, 'i').test(text)) {
        service_branch = b === 'Marine Corps' ? 'Marines' : b;
        break;
      }
    }

    const dateMatches = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g) || [];
    if (dateMatches.length >= 2) {
      service_start_date = normalizeDate(dateMatches[0]);
      service_end_date = normalizeDate(dateMatches[1]);
    }

    const dischargeMatch = text.match(/Honorable|General|Other/i);
    if (dischargeMatch) discharge_status = titleCase(dischargeMatch[0]);

    const ssnMatch = text.match(/SSN\D*(?:\d{3}-\d{2}-)?(\d{4})/i);
    if (ssnMatch) ssn_last4 = ssnMatch[1];
  }

  let applicant_name = null;
  let applicant_relationship = null;
  let eligibility_basis = null;
  const relMap = {
    self: 'veteran',
    veteran: 'veteran',
    spouse: 'spouse',
    husband: 'spouse',
    wife: 'spouse',
    child: 'child',
    son: 'child',
    daughter: 'child',
    parent: 'parent',
    father: 'parent',
    mother: 'parent',
    attorney: 'attorney',
    lawyer: 'attorney',
    representative: 'attorney',
    'government official': 'gov_official',
    official: 'gov_official',
  };
  const notary = { full_name: null, state: null, commission_expires: null };

  if (form_type === 'dd214_application') {
    const mApp = text.match(/Applicant Name[:\s]+([A-Z][A-Za-z ,.'-]+)/i);
    if (mApp) applicant_name = titleCase(mApp[1]);

    const mRel = text.match(/Relationship(?:\s*to\s*Veteran)?[:\s]+([A-Za-z ]+)/i);
    if (mRel) {
      const key = mRel[1].trim().toLowerCase();
      applicant_relationship = relMap[key] || relMap[key.split(' ')[0]] || null;
    }

    const mElig = text.match(/Eligibility[:\s]+([^\n]+)/i) || text.match(/I am[^\n]+/i);
    if (mElig) eligibility_basis = mElig[1].trim();

    const nName = text.match(/Notary(?:\s+Public)?[:\s]+([A-Z][A-Za-z ,.'-]+)/i);
    if (nName) notary.full_name = titleCase(nName[1]);
    const nState = text.match(/State of\s+([A-Z][a-z]+)/i);
    if (nState) notary.state = titleCase(nState[1]);
    const nExp = text.match(/commission expires[:\s]*([0-9\/\-]+)/i);
    if (nExp) notary.commission_expires = normalizeDate(nExp[1]);
  }

  const document_date = service_end_date || null;
  const warnings = [];
  if (service_start_date && service_end_date) {
    if (new Date(service_end_date) <= new Date(service_start_date)) {
      warnings.push('invalid_service_dates');
    }
  }

  return {
    doc_type: 'veteran_status_form',
    form_type,
    veteran_name,
    service_branch,
    service_start_date,
    service_end_date,
    discharge_status,
    ssn_last4,
    applicant_name,
    applicant_relationship,
    eligibility_basis,
    notary,
    document_date,
    confidence,
    warnings,
  };
}

module.exports = { extractVeteranStatus };
