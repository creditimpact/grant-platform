const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");

const DOC_LIBRARY_PATH = path.resolve(
  __dirname,
  '../../document_library/catalog.json'
);
const GRANTS_DIR = path.resolve(__dirname, '../../eligibility-engine/grants');

const { normalizeKey, normalizeList } = require('./documentAliases');

let docCatalogCache = null;
let docTypeCache = null;
let grantsCache = null;

function loadLibrary() {
  if (!docCatalogCache) {
    docCatalogCache = JSON.parse(fs.readFileSync(DOC_LIBRARY_PATH, 'utf8'));
  }
  return docCatalogCache;
}

function loadDocTypes() {
  if (!docTypeCache) {
    const documents = loadLibrary().documents || [];
    docTypeCache = {};
    for (const doc of documents) {
      if (!doc || !doc.key) continue;
      docTypeCache[doc.key] = doc;
    }
  }
  return docTypeCache;
}

function getDocType(key) {
  return loadDocTypes()[key];
}

function describeDoc(key) {
  const doc = loadDocTypes()[key];
  if (!doc) return { label: key };
  return {
    label: doc.display_name || doc.title || key,
    accept: doc.supported_formats || doc.accept || doc.accept_mime || [],
    family: doc.family,
    core_level: doc.core_level,
  };
}

function normalizeCaseDocuments(caseDocs = []) {
  return (caseDocs || []).map((doc) => {
    if (!doc) return doc;
    const normalized = normalizeKey(doc.doc_type || doc.docType || doc.key);
    return { ...doc, doc_type: normalized };
  });
}

function getRequiredDocs(grantKey, caseDocs = []) {
  const grants = loadGrantsLibrarySync();
  const grant = grants[grantKey];
  if (!grant) return [];
  const docs = normalizeList([
    ...(grant.common_docs || []),
    ...(grant.required_docs || []),
  ]);
  const seen = new Set();
  const uploads = normalizeCaseDocuments(caseDocs);
  return docs
    .filter((doc) => {
      if (seen.has(doc)) return false;
      seen.add(doc);
      return true;
    })
    .map((doc) => {
      const matches = uploads.filter((d) => d.doc_type === doc);
      const meta = describeDoc(doc);
      return {
        key: doc,
        doc_type: doc,
        label: meta.label,
        uploads: matches,
        fulfilled: matches.length > 0,
      };
    });
}

function loadGrantsLibrarySync() {
  if (!grantsCache) {
    const entries = {};
    const files = fs.readdirSync(GRANTS_DIR).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const grantKey = path.basename(file, '.json');
      try {
        const raw = JSON.parse(
          fs.readFileSync(path.join(GRANTS_DIR, file), 'utf8')
        );
        entries[grantKey] = {
          required_docs: normalizeList(raw.required_documents || []),
          required_forms: normalizeList(
            raw.required_forms || raw.requiredForms || []
          ),
          common_docs: normalizeList(raw.common_documents || []),
        };
      } catch (err) {
        entries[grantKey] = { required_docs: [], required_forms: [], common_docs: [] };
      }
    }
    grantsCache = entries;
  }
  return grantsCache;
}

async function loadGrantsLibrary() {
  if (grantsCache) return grantsCache;
  const entries = {};
  const files = await fsPromises.readdir(GRANTS_DIR);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const grantKey = path.basename(file, '.json');
    try {
      const raw = JSON.parse(
        await fsPromises.readFile(path.join(GRANTS_DIR, file), 'utf8')
      );
      entries[grantKey] = {
        required_docs: normalizeList(raw.required_documents || []),
        required_forms: normalizeList(
          raw.required_forms || raw.requiredForms || []
        ),
        common_docs: normalizeList(raw.common_documents || []),
      };
    } catch (err) {
      entries[grantKey] = { required_docs: [], required_forms: [], common_docs: [] };
    }
  }
  grantsCache = entries;
  return grantsCache;
}

function resetCache() {
  docCatalogCache = null;
  docTypeCache = null;
  grantsCache = null;
}

module.exports = {
  loadLibrary,
  loadDocTypes,
  getDocType,
  getRequiredDocs,
  loadGrantsLibrary,
  loadGrantsLibrarySync,
  resetCache,
};
