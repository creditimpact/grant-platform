const STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'];

function titleCase(str = '') {
  return str
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .trim();
}

function normalizeDate(str) {
  if (!str) return null;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function extractPOA({ text = '' }) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const principals = [];
  const agents = [];
  const witnesses = [];
  const canonical = [];
  const warnings = [];
  const typeFlags = {
    durable: false,
    springing: false,
    limited: false,
    statutory_short_form: false,
  };
  let signedDate = null;
  let jurisdiction = null;
  const notary = {
    full_name: null,
    commission_no: null,
    commission_expires: null,
    state: null,
    county: null,
  };

  for (const line of lines) {
    const principalMatch =
      line.match(/I[, ]+([^,\n]+)/i) ||
      line.match(/([^,\n]+)\s*,?\s*(?:the\s+)?principal/i);
    if (principalMatch) {
      principals.push({
        full_name: titleCase(principalMatch[1]),
        title_or_capacity: null,
        address: null,
      });
    }

    const agentMatch = line.match(
      /appoint\s+([^,\n]+?)\s+(?:as\s+)?(?:my\s+)?(?:agent|attorney[- ]in[- ]fact)/i,
    );
    if (agentMatch) {
      agents.push({
        full_name: titleCase(agentMatch[1]),
        address: null,
        is_successor: false,
      });
    }

    const successorMatch = line.match(/successor\s+agent[:\-]?\s*([A-Z][A-Za-z .,'-]+)/i);
    if (successorMatch) {
      agents.push({
        full_name: titleCase(successorMatch[1]),
        address: null,
        is_successor: true,
      });
    }

    const witnessMatch = line.match(/witness[:\-]?\s*([A-Z][A-Za-z .,'-]+)/i);
    if (witnessMatch) {
      witnesses.push({ full_name: titleCase(witnessMatch[1]), address: null });
    }

    const notaryMatch = line.match(/notary\s+public[:\-]?\s*([A-Z][A-Za-z .,'-]+)/i);
    if (notaryMatch && !notary.full_name) notary.full_name = titleCase(notaryMatch[1]);

    const commissionMatch = line.match(/commission\s*(?:no\.?|number)[:#]?\s*(\w+)/i);
    if (commissionMatch) notary.commission_no = commissionMatch[1].trim();

    const commissionExpMatch = line.match(/commission\s*(?:expires|exp\.?)[:#]?\s*([A-Za-z0-9 ,\/]+)/i);
    if (commissionExpMatch) notary.commission_expires = normalizeDate(commissionExpMatch[1]);

    const stateMatch = line.match(/state\s+of\s+([A-Za-z ]+)/i);
    if (stateMatch && !notary.state) notary.state = titleCase(stateMatch[1]);

    const countyMatch = line.match(/county\s+of\s+([A-Za-z ]+)/i);
    if (countyMatch && !notary.county) notary.county = titleCase(countyMatch[1]);

    if (!jurisdiction) {
      for (const st of STATES) {
        if (line.toLowerCase().includes(st.toLowerCase())) {
          jurisdiction = st;
          break;
        }
      }
    }

    if (!signedDate) {
      const dm = line.match(/(?:dated|signed\s+on|signed\s+this|on\s+this)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i) || line.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      if (dm) signedDate = normalizeDate(dm[1]);
    }

    if (line.toLowerCase().includes('durable')) typeFlags.durable = true;
    if (line.toLowerCase().includes('springing')) typeFlags.springing = true;
    if (line.toLowerCase().includes('limited')) typeFlags.limited = true;
    if (line.toLowerCase().includes('statutory short form')) typeFlags.statutory_short_form = true;

    if (/banking/i.test(line)) canonical.push('banking');
    if (/real\s+estate/i.test(line)) canonical.push('real_estate');
    if (/tax(es)?/i.test(line)) canonical.push('taxes');
    if (/insurance/i.test(line)) canonical.push('insurance');
    if (/claims?/i.test(line)) canonical.push('claims');
    if (/personal\s+property/i.test(line)) canonical.push('personal_property');
  }

  const canonicalUnique = Array.from(new Set(canonical));
  const authorityRaw = text.slice(0, 1000);

  if (!principals.length) warnings.push('principal_missing');
  if (!agents.length) warnings.push('agent_missing');

  return {
    doc_type: 'power_of_attorney',
    jurisdiction_hint: jurisdiction || null,
    type_flags: typeFlags,
    principals,
    agents,
    authority: { canonical: canonicalUnique, raw_text: authorityRaw },
    execution: {
      signed_date: signedDate || null,
      witnesses,
      notary,
    },
    confidence: principals.length && agents.length ? 0.9 : 0.7,
    warnings,
  };
}

module.exports = { extractPOA };
