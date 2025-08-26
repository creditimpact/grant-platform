# PDF Template Schema

This document explains how `server/utils/formTemplates.js` describes each PDF form and how to add new templates.

## Schema Overview
Each entry in `pdfTemplates` has the structure:

```js
form_key: {
  base: 'file-name.pdf',
  mode: 'acro' | 'absolute',
  fields: { /* for acro mode */ },
  coords: { /* for absolute mode */ },
  checkboxes: { /* optional for absolute mode */ }
}
```

**base** – filename of the blank template located in `server/templates/`.

**mode** – rendering strategy:
- `acro` uses existing AcroForm fields in the PDF.
- `absolute` draws text at fixed coordinates.

**fields** – maps your data keys to PDF field names when `mode` is `acro`:
```js
fields: {
  applicant_name: 'SF424.ApplicantName',
  ein: 'SF424.EIN'
}
```

**coords** – for `absolute` mode, maps data keys to coordinates where text should be drawn. Coordinates use the bottom‑left origin used by [pdf-lib](https://pdf-lib.js.org/):
```js
coords: {
  applicant_name: { page: 0, x: 50, y: 700, fontSize: 12 }
}
```
`page` is zero‑based. `fontSize` defaults to 9.

**checkboxes** – similar to `coords` but used to place an "X" when a boolean is true:
```js
checkboxes: {
  loan: { page: 0, x: 100, y: 640 }
}
```

## Adding a New Form
1. **Place the blank PDF** in `server/templates/` (e.g., `form_example.pdf`).
2. **Decide the rendering mode**:
   - If the PDF already contains form fields, use `acro` mode.
   - Otherwise use `absolute` mode.
3. **Extract field names or coordinates**:
   - *Acro fields*: list field names with a short script:
     ```bash
     node - <<'NODE'
     const { PDFDocument } = require('pdf-lib');
     const fs = require('fs');
     (async () => {
       const pdf = await PDFDocument.load(fs.readFileSync('server/templates/form_example.pdf'));
       pdf.getForm().getFields().forEach(f => console.log(f.getName()));
     })();
     NODE
     ```
   - *Absolute coordinates*: open the PDF in an editor that shows cursor coordinates (e.g., Adobe Acrobat, Preview + Inspector, etc.) and record the `x`/`y` positions (measured from the bottom‑left). Repeat for any checkboxes.
4. **Register the template** by adding an entry in `server/utils/formTemplates.js`:
   ```js
   form_example: {
     base: 'form_example.pdf',
     mode: 'absolute',
     coords: {
       applicant_name: { page: 0, x: 50, y: 700, fontSize: 12 }
     },
     checkboxes: {
       agree_terms: { page: 0, x: 100, y: 640 }
     }
   }
   ```
5. **Test rendering**:
   ```bash
   npm test --prefix server tests/pdfRenderer.test.js
   ```
   Add a new test case if your form requires custom behavior.

## Testing
Run the pdf renderer test to ensure templates generate valid PDFs:
```bash
npm test --prefix server tests/pdfRenderer.test.js
```
