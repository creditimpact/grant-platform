const fieldMap = require('../../eligibility-engine/contracts/field_map.json');

const aliasMap = (() => {
  const map = {};
  for (const [canonical, info] of Object.entries(fieldMap)) {
    const target = info.target || canonical;
    map[canonical] = target;
    (info.aliases || []).forEach((alias) => {
      map[alias] = target;
    });
  }
  return map;
})();

function normalizeFields(fields = {}) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    const mapped = aliasMap[key] || key;
    out[mapped] = value;
  }
  return out;
}

module.exports = { normalizeFields };
