const fieldMap = require('../../eligibility-engine/contracts/field_map.json');

const aliasMap = (() => {
  const map = {};

  const walk = (obj) => {
    for (const [canonical, info] of Object.entries(obj)) {
      if (info && typeof info === 'object' && !Array.isArray(info) && !('aliases' in info)) {
        walk(info);
        continue;
      }
      const target = info.target || canonical;
      map[canonical] = target;
      (info.aliases || []).forEach((alias) => {
        map[alias] = target;
      });
    }
  };

  walk(fieldMap);
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
