const fs = require('fs');
const path = require('path');

const DOC_LIBRARY_DIR = path.resolve(__dirname, '../../document_library');
const ALIAS_PATH = path.join(DOC_LIBRARY_DIR, 'aliases.json');
const CATALOG_PATH = path.join(DOC_LIBRARY_DIR, 'catalog.json');

let aliasCache = null;

function loadAliasMap() {
  if (!aliasCache) {
    aliasCache = new Map();
    try {
      const raw = JSON.parse(fs.readFileSync(ALIAS_PATH, 'utf8'));
      for (const [alias, canonical] of Object.entries(raw.aliases || {})) {
        aliasCache.set(alias.toLowerCase(), canonical);
      }
    } catch (err) {
      // ignore missing aliases file
    }

    try {
      const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
      for (const doc of catalog.documents || []) {
        if (!doc || !doc.key) continue;
        aliasCache.set(String(doc.key).toLowerCase(), doc.key);
        for (const alias of doc.aliases || []) {
          aliasCache.set(String(alias).toLowerCase(), doc.key);
        }
      }
    } catch (err) {
      // ignore catalog errors and fall back to alias-only map
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
