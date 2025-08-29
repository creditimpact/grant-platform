const { loadLibrary, loadDocTypes } = require('./documentLibrary');

// Build a merged checklist of required documents for a set of grant keys.
// `grants` is an array of grant identifiers (e.g. ['erc']).
// `caseDocs` is the array of documents already uploaded for the case.
// The returned value is an array of objects:
//   { doc_type, description, example_url, status }
// Where `status` is "uploaded" or "not_uploaded" based on presence in caseDocs.
function buildChecklist(grants = [], caseDocs = []) {
  const lib = loadLibrary();
  const docTypes = loadDocTypes();
  const items = new Map();

  function addDoc(d) {
    const key = d.doc_type || d.key;
    if (!key) return;
    if (items.has(key)) return;
    const spec = docTypes[key] || {};
    const uploaded = caseDocs.find(
      (c) => (c.doc_type || c.docType || c.key) === key
    );
    items.set(key, {
      doc_type: key,
      description: spec.display_name || d.label || d.description || key,
      example_url:
        (spec.examples && spec.examples[0]) ||
        (d.examples && d.examples[0]) ||
        null,
      status: uploaded ? uploaded.status || 'uploaded' : 'not_uploaded',
    });
  }

  // Common documents
  (lib.common_documents || []).forEach(addDoc);

  // Grant specific documents
  for (const gKey of grants) {
    const g = lib.grants[gKey];
    if (!g) continue;
    const list = g.required_documents || g.required_docs || [];
    list.forEach(addDoc);
  }

  return Array.from(items.values());
}

module.exports = { buildChecklist };
