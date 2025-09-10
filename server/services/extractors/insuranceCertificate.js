const fs = require('fs');
const path = require('path');
let yaml;
try {
  yaml = require('js-yaml');
} catch (e) {
  yaml = { load: () => ({}) };
}

let CACHE;
function loadSynonyms() {
  if (CACHE) return CACHE;
  try {
    const p = path.join(__dirname, '../../../config/insurance_synonyms.yaml');
    CACHE = yaml.load(fs.readFileSync(p, 'utf8')) || {};
  } catch (e) {
    CACHE = {};
  }
  return CACHE;
}

function titleCase(str = '') {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
    .trim();
}

function normalizeDate(str) {
  if (!str) return null;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function parseLimit(str) {
  if (!str) return 0;
  return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
}

function mapCoverageType(name) {
  const syn = loadSynonyms();
  const lower = name.toLowerCase();
  for (const [type, arr] of Object.entries(syn)) {
    if (arr.some((s) => lower.includes(s.toLowerCase()))) return type;
  }
  if (/workers\s+comp/i.test(lower)) return 'workers_comp';
  if (/auto/i.test(lower)) return 'auto';
  if (/umbrella|excess/i.test(lower)) return 'umbrella';
  if (/general/i.test(lower)) return 'general_liability';
  if (/property/i.test(lower)) return 'property';
  return 'other';
}

function extractInsuranceCertificate({ text = '', hints = {}, confidence = 0.9 }) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const form =
    hints.form ||
    (/ACORD\s*25/i.test(text)
      ? 'ACORD25'
      : /ACORD\s*23/i.test(text)
      ? 'ACORD23'
      : /ACORD\s*27/i.test(text)
      ? 'ACORD27'
      : /ACORD\s*28/i.test(text)
      ? 'ACORD28'
      : 'other');

  const producer = { name: null, contact: null };
  const prodIdx = lines.findIndex((l) => /^Producer/i.test(l));
  if (prodIdx !== -1) {
    const m = lines[prodIdx].match(/Producer[:\s]*(.*)/i);
    if (m && m[1]) producer.name = titleCase(m[1]);
    else if (lines[prodIdx + 1]) producer.name = titleCase(lines[prodIdx + 1]);
    if (lines[prodIdx + 2] && /@|\d/.test(lines[prodIdx + 2])) producer.contact = lines[prodIdx + 2];
  }

  const insured = { name: null, address: null };
  const insIdx = lines.findIndex((l) => /^Insured/i.test(l));
  if (insIdx !== -1) {
    const m = lines[insIdx].match(/Insured[:\s]*(.*)/i);
    if (m && m[1]) {
      insured.name = titleCase(m[1]);
      if (lines[insIdx + 1]) insured.address = titleCase(lines[insIdx + 1]);
    } else {
      insured.name = titleCase(lines[insIdx + 1] || '');
      insured.address = lines[insIdx + 2] ? titleCase(lines[insIdx + 2]) : null;
    }
  }

  const insurers = [];
  for (const line of lines) {
    const m = line.match(/^([A-F])[:\s-]+([^,]+?)(?:\s+NAIC#?\s*(\d{3,}))?$/i);
    if (m) {
      insurers.push({ letter: m[1].toUpperCase(), name: titleCase(m[2].trim()), naic: m[3] || null });
    }
  }

  const coverages = [];
  for (const line of lines) {
    const m = line.match(
      /(General Liability|Automobile|Auto|Umbrella|Workers Comp(?:ensation)?|Property)[^\n]*Policy Number\s*([A-Z0-9-]+)[^\n]*Eff(?:ective)?\s*Date\s*([0-9\/-]+)[^\n]*Exp(?:iration)?\s*Date\s*([0-9\/-]+)([^\n]*)/i,
    );
    if (m) {
      const type = mapCoverageType(m[1]);
      const eff = normalizeDate(m[3]);
      const exp = normalizeDate(m[4]);
      const rest = m[5];
      const each = rest.match(/Each\s+Occurrence\s*\$?([0-9,]+)/i);
      const agg = rest.match(/Aggregate\s*\$?([0-9,]+)/i);
      const prop = rest.match(/Property(?:\s+(?:Damage|Value))?\s*\$?([0-9,]+)/i);
      coverages.push({
        coverage_type: type,
        policy_number: m[2],
        effective_date: eff,
        expiration_date: exp,
        limits: {
          each_occurrence: parseLimit(each && each[1]),
          aggregate: parseLimit(agg && agg[1]),
          property_damage: parseLimit(prop && prop[1]),
          other: null,
        },
      });
    }
  }

  const holderIdx = lines.findIndex((l) => /^Certificate Holder/i.test(l));
  let certificate_holder = null;
  if (holderIdx !== -1) {
    const m = lines[holderIdx].match(/Certificate Holder[:\s]*(.*)/i);
    certificate_holder = titleCase(m && m[1] ? m[1] : lines[holderIdx + 1] || '');
  }

  const cancellationMatch = text.match(/cancellation[^\n]+/i);
  const cancellation_clause = cancellationMatch ? cancellationMatch[0].trim() : null;
  const sigMatch = text.match(/Authorized Representative[:\s]*([A-Za-z ,.'-]+)/i);
  const signature = sigMatch ? titleCase(sigMatch[1]) : null;

  const warnings = [];
  for (const c of coverages) {
    if (c.effective_date && c.expiration_date) {
      if (new Date(c.expiration_date) <= new Date(c.effective_date)) {
        warnings.push('invalid_date_range');
      }
    }
  }
  if (!producer.name || !insured.name) warnings.push('missing_required_section');

  return {
    doc_type: 'insurance_certificate',
    form,
    producer,
    insured,
    insurers,
    coverages,
    certificate_holder,
    cancellation_clause,
    signature,
    confidence,
    warnings,
  };
}

module.exports = { extractInsuranceCertificate };
