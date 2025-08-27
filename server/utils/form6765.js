function toFloat(val) {
  if (val === undefined || val === null || val === '') return 0;
  const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100) / 100;
}

function toPct(val) {
  const num = toFloat(String(val).replace('%', ''));
  return num > 1 ? num / 100 : num;
}

function validateForm6765Calcs(data) {
  const mismatches = [];
  const line4 = Math.max(toFloat(data.line_2_value) - toFloat(data.line_3_value), 0);
  if (toFloat(data.line_4_value) !== toFloat(line4)) mismatches.push('line_4_value');
  const line8 = toFloat(data.line_7_value) * toPct(data.line_6_pct);
  if (toFloat(data.line_8_value) !== toFloat(line8)) mismatches.push('line_8_value');
  const line9 = Math.max(toFloat(data.line_5_value) - line8, 0);
  if (toFloat(data.line_9_value) !== toFloat(line9)) mismatches.push('line_9_value');
  const line10 = toFloat(data.line_5_value) * 0.5;
  if (toFloat(data.line_10_value) !== toFloat(line10)) mismatches.push('line_10_value');
  const line11 = Math.min(line9, line10);
  if (toFloat(data.line_11_value) !== toFloat(line11)) mismatches.push('line_11_value');
  const line12 = toFloat(data.line_1_value) + line4 + line11;
  if (toFloat(data.line_12_value) !== toFloat(line12)) mismatches.push('line_12_value');
  const line13 = data.question_a_elect_reduced_credit ? line12 * 0.158 : line12 * 0.2;
  if (toFloat(data.line_13_value) !== toFloat(line13)) mismatches.push('line_13_value');
  const line17 = Math.max(toFloat(data.line_15_value) - toFloat(data.line_16_value), 0);
  if (toFloat(data.line_17_value) !== toFloat(line17)) mismatches.push('line_17_value');
  const line18 = toFloat(data.line_14_value) + line17;
  if (toFloat(data.line_18_value) !== toFloat(line18)) mismatches.push('line_18_value');
  const line19 = line18 * 0.2;
  if (toFloat(data.line_19_value) !== toFloat(line19)) mismatches.push('line_19_value');
  const line22 = toFloat(data.line_21_value) ? toFloat(data.line_21_value) / 6 : 0;
  if (toFloat(data.line_22_value) !== toFloat(line22)) mismatches.push('line_22_value');
  let line23;
  let line24;
  if (toFloat(data.line_21_value)) {
    line23 = Math.max(toFloat(data.line_20_value) - line22, 0);
    line24 = line23 * 0.14;
  } else {
    line23 = 0;
    line24 = toFloat(data.line_20_value) * 0.06;
  }
  if (toFloat(data.line_23_value) !== toFloat(line23)) mismatches.push('line_23_value');
  if (toFloat(data.line_24_value) !== toFloat(line24)) mismatches.push('line_24_value');
  const line25 = line19 + line24;
  if (toFloat(data.line_25_value) !== toFloat(line25)) mismatches.push('line_25_value');
  const line26 = data.question_a_elect_reduced_credit ? line25 * 0.79 : line25;
  if (toFloat(data.line_26_value) !== toFloat(line26)) mismatches.push('line_26_value');
  const base = toFloat(data.line_13_value) || toFloat(data.line_26_value);
  const line28 = Math.max(base - toFloat(data.line_27_value), 0);
  if (toFloat(data.line_28_value) !== toFloat(line28)) mismatches.push('line_28_value');
  const line30 = line28 + toFloat(data.line_29_value);
  if (toFloat(data.line_30_value) !== toFloat(line30)) mismatches.push('line_30_value');
  const line32 = toFloat(data.line_31_value) ? line30 - toFloat(data.line_31_value) : line30;
  if (toFloat(data.line_32_value) !== toFloat(line32)) mismatches.push('line_32_value');
  if (data.line_33a_checked) {
    const line34 = Math.min(toFloat(data.line_34_value), 500000);
    if (toFloat(data.line_34_value) !== toFloat(line34)) mismatches.push('line_34_value');
    const useCarry =
      data.line_35_value !== undefined &&
      data.line_35_value !== null &&
      data.line_35_value !== '' &&
      toFloat(data.line_35_value) !== 0;
    const line36 = useCarry
      ? Math.min(line28, line34, toFloat(data.line_35_value))
      : Math.min(line28, line34);
    if (toFloat(data.line_36_value) !== toFloat(line36)) mismatches.push('line_36_value');
  }
  const line47 = toFloat(data.line_45_value) + toFloat(data.line_46_value);
  if (toFloat(data.line_47_value) !== toFloat(line47)) mismatches.push('line_47_value');
  const line48 = toFloat(data.line_42_value) + toFloat(data.line_43_value) + toFloat(data.line_44_value) + line47;
  if (toFloat(data.line_48_value) !== toFloat(line48)) mismatches.push('line_48_value');
  return mismatches;
}

const coords = {
  names_shown_on_return: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  identifying_number: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_20_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_21_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_22_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_23_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_24_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_25_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_26_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_27_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_28_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_29_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_30_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_31_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_32_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_33a_checked: { page: 0, x: 0, y: 0, size: 9 }, // TODO
  line_33b_checked: { page: 0, x: 0, y: 0, size: 9 }, // TODO
  line_34_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_35_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_36_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_42_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_43_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_44_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_45_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_46_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_47_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
  line_48_value: { page: 0, x: 0, y: 0, fontSize: 10 }, // TODO
};

const checkboxes = {
  question_a_elect_reduced_credit: { page: 0, x: 0, y: 0, size: 9 }, // TODO
  question_b_under_common_control: { page: 0, x: 0, y: 0, size: 9 }, // TODO
  line_33a_checked: { page: 0, x: 0, y: 0, size: 9 }, // TODO
  line_33b_checked: { page: 0, x: 0, y: 0, size: 9 }, // TODO
};

const required = [
  'names_shown_on_return',
  'identifying_number',
  'line_20_value',
  'line_21_value',
];

module.exports = { coords, checkboxes, required, validateForm6765Calcs };
