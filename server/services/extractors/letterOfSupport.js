const MONTHS = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
};

function titleCase(str = '') {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
    .trim();
}

function parseDate(str) {
  if (!str) return null;
  const m = str.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (!m) return null;
  const mo = MONTHS[m[1].toLowerCase()];
  if (!mo) return null;
  const day = String(m[2]).padStart(2, '0');
  return `${m[3]}-${mo}-${day}`;
}

function extractLetterOfSupport({ text = '', confidence = 0.9 }) {
  const lines = text
    .replace(/\r/g, '')
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length);

  let recipient = null;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const l = lines[i];
    const dear = l.match(/^Dear\s+(.*)/i);
    if (dear) {
      recipient = titleCase(dear[1].replace(/[:;,]+$/, ''));
      break;
    }
    if (/^To Whom It May Concern/i.test(l)) {
      recipient = 'To Whom It May Concern';
      break;
    }
  }

  const dateMatch = text.match(/(?:Dated[:\s]*)?([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i);
  const document_date = dateMatch ? parseDate(dateMatch[1]) : null;

  const closingIdx = lines.findIndex((l) => /(Sincerely|Respectfully|Best regards)/i.test(l));
  const closing = closingIdx !== -1 ? lines[closingIdx] : null;
  const afterClosing = closingIdx !== -1 ? lines.slice(closingIdx + 1) : [];

  let full_name = null;
  let title = null;
  let organization = null;
  let contact = null;
  if (afterClosing.length) {
    let idx = 0;
    if (afterClosing[idx]) {
      full_name = titleCase(afterClosing[idx]);
      idx++;
    }
    if (afterClosing[idx]) {
      const parts = afterClosing[idx].split(/,\s*/);
      if (parts.length > 1) {
        title = titleCase(parts[0]);
        organization = titleCase(parts.slice(1).join(', '));
        idx++;
      } else {
        title = titleCase(afterClosing[idx]);
        idx++;
        if (afterClosing[idx]) {
          organization = titleCase(afterClosing[idx]);
          idx++;
        }
      }
    }
    if (!organization && afterClosing[idx]) {
      organization = titleCase(afterClosing[idx]);
      idx++;
    }
    contact = afterClosing.slice(idx).join(' ') || null;
  }

  const REL_PATTERNS = [
    /I have worked with[^.]*\./i,
    /As a [^.]*\./i,
    /I know [^.]*\./i,
    /I have mentored [^.]*\./i,
  ];
  let relationship = null;
  for (const r of REL_PATTERNS) {
    const m = text.match(r);
    if (m) {
      relationship = m[0].trim();
      break;
    }
  }

  const salutationIdx = lines.findIndex((l) => /^Dear|^To Whom It May Concern/i.test(l));
  const bodyStart = salutationIdx !== -1 ? salutationIdx + 1 : 0;
  const bodyEnd = closingIdx !== -1 ? closingIdx : lines.length;
  const body = lines.slice(bodyStart, bodyEnd).join(' ').trim();
  const endorsement_text = body ? body.slice(0, 500) : null;

  const hasSignatureImage = /\[signature\]|signature image/i.test(text);

  return {
    doc_type: 'letter_of_support',
    recipient: recipient || null,
    author: {
      full_name: full_name || null,
      title: title || null,
      organization: organization || null,
      contact: contact || null,
    },
    relationship: relationship || null,
    endorsement_text: endorsement_text || null,
    signature_block: {
      has_signature_image: !!hasSignatureImage,
      closing: closing || null,
    },
    document_date: document_date || null,
    confidence,
    warnings: [],
  };
}

module.exports = { extractLetterOfSupport };
