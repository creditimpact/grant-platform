function toFloat(val) {
  if (val === undefined || val === null || val === '') return 0;
  const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100) / 100;
}

function validateForm8974Calcs(data) {
  const mismatches = [];
  const line6 =
    toFloat(data.line1_remaining_credit) +
    toFloat(data.line2_remaining_credit) +
    toFloat(data.line3_remaining_credit) +
    toFloat(data.line4_remaining_credit) +
    toFloat(data.line5_remaining_credit);
  if (toFloat(data.line6) !== line6) mismatches.push('line6');
  const line10 = toFloat(data.line8) + toFloat(data.line9);
  if (toFloat(data.line10) !== line10) mismatches.push('line10');
  const line11 = toFloat(line10 * 0.5);
  if (toFloat(data.line11) !== line11) mismatches.push('line11');
  const line12 = Math.min(toFloat(data.line7), line11, 250000);
  if (toFloat(data.line12) !== toFloat(line12)) mismatches.push('line12');
  const line13 = toFloat(data.line7) - line12;
  if (toFloat(data.line13) !== toFloat(line13)) mismatches.push('line13');
  const line15 = toFloat(data.line14) * 0.5;
  if (toFloat(data.line15) !== toFloat(line15)) mismatches.push('line15');
  const line16 = Math.min(line13, line15);
  if (toFloat(data.line16) !== toFloat(line16)) mismatches.push('line16');
  const line17 = line12 + line16;
  if (toFloat(data.line17) !== toFloat(line17)) mismatches.push('line17');
  return mismatches;
}

module.exports = { validateForm8974Calcs };
