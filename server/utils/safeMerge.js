function safeMerge(target = {}, incoming = {}, { source = 'analyzer', questionnaire = {} } = {}) {
  const merged = { ...target };
  const updatedKeys = [];
  for (const [k, v] of Object.entries(incoming || {})) {
    if (source === 'analyzer') {
      if (v === null || v === undefined || v === '') continue;
      const qVal = questionnaire[k];
      if (qVal !== undefined && qVal !== null && qVal !== '') continue;
    }
    if (merged[k] !== v) {
      merged[k] = v;
      updatedKeys.push(k);
    }
  }
  return { merged, updatedKeys };
}
module.exports = { safeMerge };
