const MONTHS = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
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
  const m = str.match(/([A-Za-z]{3,9})\s*(\d{4})/);
  if (m) {
    const mo = MONTHS[m[1].slice(0,3).toLowerCase()];
    if (mo) return `${m[2]}-${mo}`;
  }
  const year = str.match(/\b(\d{4})\b/);
  if (year) return `${year[1]}-01`;
  return null;
}

function extractSection(lines, nameRegex) {
  const re = new RegExp(`^${nameRegex}$`, 'i');
  const idx = lines.findIndex((l) => re.test(l));
  if (idx === -1) return null;
  const out = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[A-Z][A-Z \-/&]{2,}$/.test(line)) break;
    out.push(line);
  }
  return out;
}

function normalizeDegree(str = '') {
  str = str.toLowerCase();
  if (/b\.?s\.?|bachelor/.test(str)) return 'bachelor';
  if (/m\.?s\.?|master/.test(str)) return 'master';
  if (/phd|doctor/.test(str)) return 'phd';
  if (/associate/.test(str)) return 'associate';
  if (/certificate/.test(str)) return 'certificate';
  return 'other';
}

function extractResume({ text = '', confidence = 0.9 }) {
  const lines = text
    .replace(/\r/g, '')
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length);

  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = text.match(/\+?\d[\d\s().-]{7,}/);
  let city = null;
  let state = null;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const m = lines[i].match(/([A-Za-z .]+),\s*([A-Z]{2})(?:\s+\d{5})?/);
    if (m) { city = titleCase(m[1]); state = m[2]; break; }
  }
  let full_name = null;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const l = lines[i];
    if (emailMatch && l.includes(emailMatch[0])) continue;
    if (phoneMatch && l.includes(phoneMatch[0])) continue;
    if (/^(summary|professional experience|education|technical skills|skills|certifications)/i.test(l)) continue;
    full_name = titleCase(l);
    break;
  }

  const summaryLines = extractSection(lines, '(SUMMARY OF QUALIFICATIONS|SUMMARY|OBJECTIVE)');
  const summary = summaryLines ? summaryLines.join(' ') : null;

  const eduLines = extractSection(lines, 'EDUCATION') || [];
  const education = [];
  let currentEdu = null;
  for (const line of eduLines) {
    if (/^(gpa[:\s]+)/i.test(line)) {
      if (currentEdu) currentEdu.gpa = line.replace(/gpa[:\s]*/i, '').trim();
      continue;
    }
    const degreeMatch = line.match(/(Bachelor|Master|Associate|B\.S\.|B\.A\.|M\.S\.|MBA|PhD|Certificate)[^,\n]*?(?:in\s+([^,]+))?,?\s*([^,\n]+)?/i);
    if (degreeMatch) {
      if (currentEdu) education.push(currentEdu);
      currentEdu = {
        degree: normalizeDegree(degreeMatch[1]),
        field: degreeMatch[2] ? titleCase(degreeMatch[2]) : null,
        institution: degreeMatch[3] ? titleCase(degreeMatch[3]) : null,
        location: null,
        start_date: null,
        end_date: null,
        gpa: null,
        honors: [],
      };
      const dateMatch = line.match(/(\d{4})/g);
      if (dateMatch) currentEdu.end_date = `${dateMatch.pop()}-01`;
      continue;
    }
    const locMatch = line.match(/([A-Za-z .]+),\s*([A-Z]{2})/);
    if (locMatch && currentEdu) {
      currentEdu.location = `${titleCase(locMatch[1])}, ${locMatch[2]}`;
      const year = line.match(/(\d{4})/);
      if (year) currentEdu.end_date = `${year[1]}-01`;
    }
  }
  if (currentEdu) education.push(currentEdu);

  const expLines = extractSection(lines, '(PROFESSIONAL EXPERIENCE|WORK HISTORY|EXPERIENCE)') || [];
  const experience = [];
  let currentExp = null;
  for (const line of expLines) {
    if (/^[-•]/.test(line)) {
      if (currentExp) currentExp.highlights.push(line.replace(/^[-•]\s*/, ''));
      continue;
    }
    const jobMatch = line.match(/^(.*?),\s*(.*?),\s*([A-Za-z .]+),\s*([A-Z]{2})\s*\(([^)]+)\)/);
    if (jobMatch) {
      if (currentExp) experience.push(currentExp);
      const range = jobMatch[5];
      let start = null;
      let end = null;
      let currently = false;
      const parts = range.split(/\s*(?:-|–|to)\s*/);
      if (parts[0]) start = parseDate(parts[0]);
      if (parts[1]) {
        if (/present/i.test(parts[1])) { currently = true; }
        else end = parseDate(parts[1]);
      }
      currentExp = {
        role_title: jobMatch[1].trim(),
        organization: jobMatch[2].trim(),
        location: `${titleCase(jobMatch[3])}, ${jobMatch[4]}`,
        start_date: start,
        end_date: end,
        currently,
        highlights: [],
      };
      continue;
    }
  }
  if (currentExp) experience.push(currentExp);

  const skillsLines = extractSection(lines, '(TECHNICAL SKILLS|COMPUTER SKILLS|SKILLS|TECHNICAL KNOWLEDGE AND SKILLS)') || [];
  const tokens = skillsLines.join(',').split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
  const skills = { technical: [], general: [] };
  for (const t of tokens) {
    if (/javascript|node|python|java|c\+\+|sql|aws|docker|kubernetes|html|css|react/i.test(t)) skills.technical.push(t);
    else skills.general.push(t);
  }

  const certLines = extractSection(lines, '(CERTIFICATIONS|CERTIFICATION)') || [];
  const certifications = certLines.map((l) => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean);

  let last_updated = null;
  const rev = text.match(/Revision[:\s]+([A-Za-z]{3,9})\s*(\d{4})/i);
  if (rev) {
    const mo = MONTHS[rev[1].slice(0,3).toLowerCase()];
    if (mo) last_updated = `${rev[2]}-${mo}-01`;
  }

  const warnings = [];
  if (!full_name && !(emailMatch && phoneMatch)) warnings.push('missing_name_or_contact');
  if (education.length === 0 && experience.length === 0) warnings.push('missing_education_and_experience');

  return {
    doc_type: 'resume',
    full_name: full_name || null,
    contact: {
      email: emailMatch ? emailMatch[0] : null,
      phone: phoneMatch ? phoneMatch[0] : null,
      location: { city, state, country: null },
      links: { linkedin: null, github: null, website: null },
    },
    summary,
    experience,
    education,
    skills,
    certifications,
    affiliations: [],
    awards: [],
    last_updated,
    confidence,
    warnings,
  };
}

module.exports = { extractResume };
