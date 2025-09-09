const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const CA_PROVINCES = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'];

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

function computeIsRecent(dateStr, type) {
  if (!dateStr) return true;
  const maxAges = {
    utility_bill: parseInt(process.env.UTILITIES_MAX_AGE_DAYS || '90', 10),
    insurance: parseInt(process.env.INSURANCE_MAX_AGE_DAYS || '90', 10),
    lease: parseInt(process.env.LEASE_MAX_AGE_DAYS || '365', 10),
    gov_notice: parseInt(process.env.GOV_LICENSE_MAX_AGE_DAYS || '365', 10),
    business_license: parseInt(process.env.GOV_LICENSE_MAX_AGE_DAYS || '365', 10),
    bank_statement: parseInt(process.env.UTILITIES_MAX_AGE_DAYS || '90', 10),
  };
  const max = maxAges[type] || 365;
  const doc = new Date(dateStr);
  const diff = (Date.now() - doc.getTime()) / (1000 * 60 * 60 * 24);
  return diff <= max;
}

const RE_DATE = /\b(?:Statement|Billing|Issue|Effective|Start)\s*Date[:\s]*([A-Za-z]{3,9}\s+\d{1,2},\s*\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/i;
const RE_RANGE = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*(?:to|-|–|through)\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/i;
const RE_ACCOUNT = /\b(Account|Acct|Customer|Policy|License)\s*(No\.|Number|#)?\s*[:#]?\s*([A-Z0-9\-* ]{4,})\b/i;
const RE_US_POSTAL = /\b\d{5}(?:-\d{4})?\b/;
const RE_CA_POSTAL = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/i;
const RE_LINE1 = /\b\d{1,6}\s+[A-Za-z0-9.#\- ]{4,}(?:Apt|Suite|Ste|Unit|Fl|#)?\s*[A-Za-z0-9\-]*\b/;

function parseAddress(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  let raw = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/(Service Address|Service Location|Billing Address|Mailing Address|Premises|Physical Address|Address)[:\s]*(.+)/i);
    if (m) {
      raw = m[2];
      if (i + 1 < lines.length && !RE_US_POSTAL.test(raw) && !RE_CA_POSTAL.test(raw)) {
        raw = raw + ' ' + lines[i + 1];
      }
      break;
    }
  }
  if (!raw) {
    for (let i = 0; i < lines.length - 1; i++) {
      if (RE_LINE1.test(lines[i]) && (RE_US_POSTAL.test(lines[i + 1]) || RE_CA_POSTAL.test(lines[i + 1]))) {
        raw = lines[i] + ', ' + lines[i + 1];
        break;
      }
    }
  }
  if (!raw) return { line1: null, line2: null, city: null, state: null, postal_code: null, country: null, raw: null };
  const parts = raw.split(/,\s*/);
  const line1 = titleCase(parts.shift());
  let city = null;
  let state = null;
  let postal = null;
  if (parts.length) {
    const last = parts.pop();
    const m = last.match(/([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?|[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d)/);
    if (m) {
      state = m[1].toUpperCase();
      postal = m[2].toUpperCase();
      city = titleCase(parts.join(', '));
    } else {
      city = titleCase([last, ...parts].join(', '));
    }
  }
  return {
    line1,
    line2: null,
    city,
    state,
    postal_code: postal,
    country: null,
    raw,
  };
}

function extractProofOfAddress({ text = '', hints = {}, confidence = 0.9 }) {
  const issuerLines = text.split(/\r?\n/).slice(0, 10);
  const issuer = issuerLines.find((l) => /(City of|County of|State of|Department|Company|Corporation|LLC|Inc\.|Insurance|Utility|Energy|Water|Bank)/i.test(l));

  const address = parseAddress(text);

  const dateMatch = text.match(RE_DATE);
  const document_date = normalizeDate(dateMatch ? dateMatch[1] : null);
  const rangeMatch = text.match(RE_RANGE);
  const period = {
    start: normalizeDate(rangeMatch ? rangeMatch[1] : null),
    end: normalizeDate(rangeMatch ? rangeMatch[2] : null),
  };
  const accountMatch = text.match(RE_ACCOUNT);
  const account_number = accountMatch ? accountMatch[3].trim() : null;

  const subject = { person_name: null, business_name: null };
  for (const line of issuerLines) {
    const pm = line.match(/(?:Customer|Account Holder|Resident|Tenant|Insured)[:\s]+([A-Z][A-Za-z .,'-]+)/i);
    if (pm) { subject.person_name = titleCase(pm[1]); break; }
  }
  for (const line of issuerLines) {
    const bm = line.match(/(?:Business Name|Company|Registered Entity|Licensee|DBA)[:\s]+([A-Z0-9 &'\.-]+)/i);
    if (bm) { subject.business_name = titleCase(bm[1]); break; }
  }

  const warnings = [];
  if (!address.city || !address.state) warnings.push('missing_city_or_state');
  if (document_date && !computeIsRecent(document_date, hints.evidence_type)) warnings.push('stale_document');

  const is_recent = computeIsRecent(document_date, hints.evidence_type);

  return {
    doc_type: 'proof_of_address',
    evidence_type: hints.evidence_type || 'other',
    issuer: { name: issuer ? titleCase(issuer) : null },
    subject,
    address,
    document_date,
    period,
    account_number,
    is_recent,
    confidence,
    warnings,
  };
}

module.exports = { extractProofOfAddress };
