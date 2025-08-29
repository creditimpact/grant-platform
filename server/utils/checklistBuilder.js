/**
 * Build a deduplicated checklist for a case given grants library & case state.
 * @param {Object} params
 * @param {string[]} params.shortlistedGrants - grant keys (e.g. ["erc", "business_tax_refund"])
 * @param {Object} params.grantsLibrary - parsed grants_v1.json
 * @param {Array<Object>} [params.caseDocuments] - existing Case.documents[]
 * @param {Function} [params.describe] - optional (docType) => { description, example_url }
 * @returns {{ required: Array<Object> }}
 */
async function buildChecklist({
  shortlistedGrants,
  grantsLibrary,
  caseDocuments = [],
  describe,
}) {
  const lower = (s) => (s || '').toLowerCase();

  const commonDocs = new Set();
  const grantDocsMap = new Map(); // docTypeLower -> { doc_type, grants: Set() }

  for (const g of shortlistedGrants || []) {
    const cfg = grantsLibrary[g] || {};
    for (const d of cfg.common_docs || []) commonDocs.add(lower(d));
    for (const d of cfg.required_docs || []) {
      const k = lower(d);
      if (!grantDocsMap.has(k)) {
        grantDocsMap.set(k, { doc_type: d, grants: new Set([g]) });
      } else {
        grantDocsMap.get(k).grants.add(g);
      }
    }
  }

  // Merge & dedupe
  const merged = new Map(); // key -> item
  // a) common first
  for (const dLower of commonDocs) {
    const docType = grantDocsMap.get(dLower)?.doc_type || dLower.toUpperCase();
    merged.set(dLower, {
      doc_type: docType,
      source: 'common',
      grants: [],
    });
  }
  // b) grant-specific (may override source to "grant" if exists in common)
  for (const [k, val] of grantDocsMap) {
    const existing = merged.get(k);
    const grantsArr = Array.from(val.grants);
    if (existing) {
      existing.source = 'grant';
      existing.grants = Array.from(
        new Set([...(existing.grants || []), ...grantsArr])
      );
    } else {
      merged.set(k, {
        doc_type: val.doc_type,
        source: 'grant',
        grants: grantsArr,
      });
    }
  }

  // Hydrate status from caseDocuments
  const statusByType = new Map();
  for (const d of caseDocuments || []) {
    if (d && d.doc_type) {
      statusByType.set(lower(d.doc_type), d.status || 'uploaded');
    }
  }

  // Enrich with status + descriptions
  const describeDoc = describe || (() => ({}));
  const items = Array.from(merged.values()).map((i) => {
    const meta = describeDoc(i.doc_type) || {};
    const status = statusByType.get(lower(i.doc_type)) || 'not_uploaded';
    const out = { ...i, status };
    if (meta.description) out.description = meta.description;
    if (meta.example_url) out.example_url = meta.example_url;
    return out;
  });

  // Sort: common → grant, then by doc_type
  items.sort((a, b) => {
    if (a.source !== b.source) return a.source === 'common' ? -1 : 1;
    return a.doc_type.localeCompare(b.doc_type);
  });

  return { required: items };
}

module.exports = { buildChecklist };

