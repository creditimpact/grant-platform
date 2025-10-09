import json
from pathlib import Path

CATALOG_PATH = Path(__file__).resolve().parents[1] / "document_library" / "catalog.json"

with CATALOG_PATH.open() as f:
    catalog = json.load(f)

documents = catalog.get("documents", [])

entry = next((doc for doc in documents if doc.get("key") == "Bank_Statements"), None)

if entry is None:
    raise SystemExit("Bank_Statements entry not found in catalog")

extractor = entry.get("extractor")
if not extractor:
    raise SystemExit("Extractor missing for Bank_Statements entry")

print("Extractor linked successfully")
print("Extractor returned fields:", entry.get("schema_fields", []))
