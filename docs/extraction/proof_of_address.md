# Proof of Address Extraction

This module detects and normalizes common proof of address (PoA) documents such as utility bills, leases, government notices and insurance statements.

## Signals
- Presence of address block (street number + city/state/postal)
- Keywords indicating document family:
  - Utility: "Service Address", "Account Number", "Statement Date"
  - Lease: "Tenant", "Landlord", "Premises"
  - Government: "Department", "City of", "Tax"
  - Insurance: "Policy", "Insured", "Declarations"

## Schema
The extractor returns objects with the shape:

```json
{
  "doc_type": "proof_of_address",
  "evidence_type": "utility_bill|lease|gov_notice|insurance|business_license|bank_statement|other",
  "issuer": { "name": "string|null" },
  "subject": {
    "person_name": "string|null",
    "business_name": "string|null"
  },
  "address": {
    "line1": "string|null",
    "line2": "string|null",
    "city": "string|null",
    "state": "string|null",
    "postal_code": "string|null",
    "country": "string|null",
    "raw": "string|null"
  },
  "document_date": "YYYY-MM-DD|null",
  "period": { "start": "YYYY-MM-DD|null", "end": "YYYY-MM-DD|null" },
  "account_number": "string|null",
  "is_recent": true,
  "confidence": 0.0,
  "warnings": []
}
```

## Extending
Keyword lists and provider names may be augmented in `config/address_synonyms.yaml`. The extractor is layout agnostic and relies on simple heuristics so additional providers can be supported without code changes by editing the config.
