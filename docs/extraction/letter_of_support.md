# Letter of Support / Recommendation Extraction

The letter of support extractor identifies recommendation-style letters and normalizes key fields for eligibility review.

## Detection

`detectDocType` looks for textual signals such as headings ("Letter of Support", "Letter of Recommendation"), salutation phrases ("To Whom It May Concern", "Dear Grant Committee"), endorsement phrases ("I am pleased to recommend", "I write in support of"), signature closings ("Sincerely", "Respectfully", "Best regards"), and contact lines (email/phone). Documents with at least two signals and over 150 words are classified as `doc_type = "letter_of_support"` with confidence 0.6 + 0.1 per signal (capped at 0.95). An explicit heading adds an extra 0.05.

## Extracted Schema

```
{
  doc_type: 'letter_of_support',
  recipient: string|null,
  author: {
    full_name: string|null,
    title: string|null,
    organization: string|null,
    contact: string|null
  },
  relationship: string|null,
  endorsement_text: string|null,
  signature_block: {
    has_signature_image: boolean,
    closing: string|null
  },
  document_date: YYYY-MM-DD|null,
  confidence: number,
  warnings: string[]
}
```

## Notes

- `endorsement_text` is truncated to ~500 characters for downstream checks.
- `relationship` captures the sentence describing how the author knows the applicant.
- Extend detection by adding new relationship phrases or signature closings as needed.
