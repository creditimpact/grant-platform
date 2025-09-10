# Insurance Certificate Extraction

Supports common ACORD insurance certificate forms (25, 23, 27, 28) and generic certificates of insurance.

## Signals
- Titles such as "CERTIFICATE OF LIABILITY INSURANCE" or "EVIDENCE OF PROPERTY INSURANCE"
- Section headers: Producer, Insured, Insurers Affording Coverage, Coverages, Certificate Holder
- Table columns: Policy Number, Eff Date, Exp Date, Limits
- Optional ACORD form number

## Schema
```json
{
  "doc_type": "insurance_certificate",
  "form": "ACORD25|ACORD23|ACORD27|ACORD28|other",
  "producer": { "name": "string|null", "contact": "string|null" },
  "insured": { "name": "string|null", "address": "string|null" },
  "insurers": [ { "letter": "A|B|C|D|E|F", "name": "string|null", "naic": "string|null" } ],
  "coverages": [
    {
      "coverage_type": "general_liability|auto|umbrella|workers_comp|property|other",
      "policy_number": "string|null",
      "effective_date": "YYYY-MM-DD|null",
      "expiration_date": "YYYY-MM-DD|null",
      "limits": {
        "each_occurrence": 0,
        "aggregate": 0,
        "property_damage": 0,
        "other": "string|null"
      }
    }
  ],
  "certificate_holder": "string|null",
  "cancellation_clause": "string|null",
  "signature": "string|null",
  "confidence": 0.0,
  "warnings": []
}
```

## Extending
Coverage type synonyms can be tuned via `config/insurance_synonyms.yaml` to handle custom wording. The extractor is layout
agnostic and relies on heuristics so additional certificate formats can be supported by editing the config.
