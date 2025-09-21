# Veteran Status Forms

Detects and extracts information from DD-214 discharge certificates and applications for certified copies.

## Signals
- Titles such as "DD Form 214", "Certificate of Release or Discharge from Active Duty", and "Application for Certified Copy of Military Discharge"
- Phrases like "Department of Defense", "Armed Forces", "Service Branch", "Discharge"
- Application indicators: "Eligibility", "Applicant Information", "Notary", references to state codes

## Schema
```json
{
  "doc_type": "veteran_status_form",
  "form_type": "dd214_certificate|dd214_application|other",
  "veteran_name": "string|null",
  "service_branch": "Army|Navy|Air Force|Marines|Coast Guard|null",
  "service_start_date": "YYYY-MM-DD|null",
  "service_end_date": "YYYY-MM-DD|null",
  "discharge_status": "Honorable|General|Other|null",
  "ssn_last4": "string|null",
  "applicant_name": "string|null",
  "applicant_relationship": "veteran|spouse|child|parent|attorney|gov_official|null",
  "eligibility_basis": "string|null",
  "notary": {
    "full_name": "string|null",
    "state": "string|null",
    "commission_expires": "YYYY-MM-DD|null"
  },
  "document_date": "YYYY-MM-DD|null",
  "confidence": 0.0,
  "warnings": []
}
```

## Examples
- DD-214 Certificate with service dates and discharge status
- DD-214 Application including applicant relationship and notary block

## Extending
Future support may include additional veteran forms such as NGB-22 or military IDs.
