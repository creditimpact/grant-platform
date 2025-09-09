# Resume Extraction

The resume extractor detects common resume/CV layouts and normalizes core fields for case processing.

## Detection

`detectDocType` looks for strong signals such as section headers (`SUMMARY OF QUALIFICATIONS`, `PROFESSIONAL EXPERIENCE`, `EDUCATION`, `TECHNICAL SKILLS`) combined with contact info (email/phone). At least two headers plus contact details yield `doc_type = "resume"` with confidence ≥ 0.8.

## Extracted Schema

```
{
  doc_type: 'resume',
  full_name: string|null,
  contact: {
    email: string|null,
    phone: string|null,
    location: { city, state, country },
    links: { linkedin, github, website }
  },
  summary: string|null,
  experience: [{ role_title, organization, location, start_date, end_date, currently, highlights[] }],
  education: [{ degree, field, institution, location, start_date, end_date, gpa, honors[] }],
  skills: { technical: string[], general: string[] },
  certifications: string[],
  affiliations: string[],
  awards: string[],
  last_updated: YYYY-MM-DD|null,
  confidence: number,
  warnings: string[]
}
```

## Notes

- Dates are normalized to `YYYY-MM` when possible.
- Skills are split into basic technical vs. general keywords.
- `last_updated` is derived from `Revision:` markers when present.
