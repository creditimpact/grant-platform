# Server API

### `POST /api/files/upload`
Multipart form fields:
- `file` – document to analyze
- optional `caseId`

Supported file extensions: `.pdf`, `.docx`, `.txt`, `.png`, `.jpeg`, `.jpg`, `.bmp`.

Response: case snapshot including `caseId`, `documents` array and any extracted `analyzerFields`.

### `POST /api/questionnaire`
JSON body:
```json
{ "caseId": "abc", "answers": { "field": "value" } }
```
Merges answers with previously extracted fields and returns an updated case snapshot.

### `POST /api/eligibility-report`
JSON body:
```json
{ "caseId": "abc" }
```
Runs the eligibility engine and returns a case snapshot with an `eligibility` array and any `requiredForms`.

### `GET /api/status/:caseId`
Fetch the full case snapshot for the given case.

### `GET /api/case/status`
Development shortcut to fetch the latest case when no `caseId` is known.

## PDF Templates

See [pdfTemplates.md](pdfTemplates.md) for details on defining PDF form templates.
