const escapeText = (str) =>
  str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, '\n');

function buildPdf(lines) {
  let stream = 'BT /F1 12 Tf 72 720 Td ';
  lines.forEach((line, idx) => {
    stream += `(${escapeText(line)}) Tj`;
    if (idx < lines.length - 1) stream += ' T* ';
  });
  stream += ' ET';
  const len = Buffer.byteLength(stream, 'utf8');
  const objs = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj',
    `4 0 obj<< /Length ${len} >>stream\n${stream}\nendstream\nendobj`,
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objs.forEach((o) => {
    offsets.push(pdf.length);
    pdf += o + '\n';
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += offsets[i].toString().padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

async function renderPdf({ formId, filledForm }) {
  if (!filledForm) throw new Error('filledForm required');
  const fields = filledForm.fields || filledForm;
  const lines = [`Form ${formId}`];
  for (const [k, v] of Object.entries(fields)) {
    lines.push(`${k}: ${v}`);
  }
  return buildPdf(lines);
}

module.exports = { renderPdf };
