const fs = require("fs");
const path = require("path");

const LIB_PATH = path.resolve(
  __dirname,
  "../../shared/document_library/grants_v1.json"
);
const DOC_TYPES_DIR = path.resolve(__dirname, "../../shared/document_types");
const DOC_CATALOG = path.join(DOC_TYPES_DIR, "catalog.json");

let cache = null;
let docTypeCache = null;

const DOC_TYPES = {
  IRS_941X: { title: "IRS Form 941-X", accept: [".pdf"], minBytes: 10_000 },
};

function loadLibrary() {
  if (!cache) {
    cache = JSON.parse(fs.readFileSync(LIB_PATH, "utf8"));
  }
  return cache;
}

function loadDocTypes() {
  if (!docTypeCache) {
    const raw = JSON.parse(fs.readFileSync(DOC_CATALOG, "utf8")).types;
    docTypeCache = {};
    for (const [key, spec] of Object.entries(raw)) {
      if (spec && spec.$ref) {
        const p = path.join(DOC_TYPES_DIR, spec.$ref);
        docTypeCache[key] = JSON.parse(fs.readFileSync(p, "utf8"));
      } else {
        docTypeCache[key] = spec;
      }
    }
  }
  return docTypeCache;
}

function getDocType(key) {
  return loadDocTypes()[key];
}

function getRequiredDocs(grantKey, caseDocs = []) {
  const lib = loadLibrary();
  const g = lib.grants[grantKey];
  if (!g) return null;
  const types = loadDocTypes();
  const all = [
    ...(lib.common_documents || []),
    ...(g.required_documents || []),
  ];
  const seen = new Map();
  for (const d of all) {
    const key = d.doc_type || d.key;
    if (!key || seen.has(key)) continue;
    if (d.doc_type) {
      const spec = types[d.doc_type] || {};
      const uploads = caseDocs.filter(
        (c) => (c.docType || c.doc_type) === d.doc_type
      );
      const min = d.min_count || 1;
      seen.set(key, {
        key: d.doc_type,
        doc_type: d.doc_type,
        label: spec.display_name || d.doc_type,
        min_count: min,
        uploads,
        fulfilled: uploads.length >= min,
      });
    } else {
      const uploads = caseDocs.filter(
        (c) => (c.key || c.evidence_key) === key
      );
      const min = d.min_count || 1;
      seen.set(key, {
        key,
        doc_type: key,
        label: d.label || key,
        min_count: min,
        uploads,
        fulfilled: uploads.length >= min,
      });
    }
  }
  return Array.from(seen.values());
}

module.exports = { loadLibrary, getRequiredDocs, loadDocTypes, getDocType, DOC_TYPES };
