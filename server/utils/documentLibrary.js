const fs = require("fs");
const path = require("path");

const LIB_PATH = path.resolve(__dirname, "../../shared/document_library/grants_v1.json");

let cache = null;
function loadLibrary() {
  if (!cache) {
    cache = JSON.parse(fs.readFileSync(LIB_PATH, "utf8"));
  }
  return cache;
}

function getRequiredDocs(grantKey) {
  const lib = loadLibrary();
  const g = lib.grants[grantKey];
  if (!g) return null;
  return g.required_documents;
}

module.exports = { loadLibrary, getRequiredDocs };
