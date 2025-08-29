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
  return g.required_documents.map((d) => {
    if (d.doc_type) {
      const spec = types[d.doc_type] || {};
      const uploads = caseDocs.filter((c) => c.docType === d.doc_type);
      const min = d.min_count || 1;
      return {
        key: d.doc_type,
        doc_type: d.doc_type,
        label: spec.display_name || d.doc_type,
        min_count: min,
        uploads,
        fulfilled: uploads.length >= min,
      };
    }
    return d;
  });
}

module.exports = { loadLibrary, getRequiredDocs, loadDocTypes, getDocType };
