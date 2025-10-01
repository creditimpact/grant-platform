const fs = require('fs');
const path = require('path');

const ALIAS_PATH = path.resolve(
  __dirname,
  '../../shared/normalization/document_aliases.json'
);

let aliasCache = null;

function loadAliasMap() {
  if (!aliasCache) {
    try {
      const raw = JSON.parse(fs.readFileSync(ALIAS_PATH, 'utf8'));
      const entries = Object.entries(raw.aliases || {});
      aliasCache = new Map(entries.map(([alias, canonical]) => [alias.toLowerCase(), canonical]));
    } catch (err) {
      aliasCache = new Map();
    }
  }
  return aliasCache;
}

function normalizeKey(key) {
  if (!key || typeof key !== 'string') return key;
  const trimmed = key.trim();
  if (!trimmed) return trimmed;
  const map = loadAliasMap();
  return map.get(trimmed.toLowerCase()) || trimmed;
}

function normalizeList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const normalized = normalizeKey(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

module.exports = {
  loadAliasMap,
  normalizeKey,
  normalizeList,
};
