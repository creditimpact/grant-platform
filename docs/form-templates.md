# Form Template Versioning

This service stores form templates in MongoDB with version numbers. Every update creates a new `FormTemplate` document with an incremented `version` and links submissions to the specific version used.

## Workflow
1. Create a template using `POST /api/form-template` with a JSON body:
   ```json
   {
     "key": "eligibility_form",
     "template": { /* original template JSON */ },
     "schema": {
       "required": ["name"],
       "properties": { "name": { "type": "string" } }
     }
   }
   ```
   This endpoint requires an authenticated admin user and automatically assigns the next version number.
2. Retrieve the latest version with `GET /api/form-template/:key` or a specific version with `GET /api/form-template/:key/:version`.
3. When the AI agent fills a form, the platform records `{formKey, version, data}` in the case's `generatedForms` array.
4. Submissions are validated against the schema attached to their `formKey` and `version`.

## Schema Updates
- Schemas follow a minimal JSON schema subset: `required` fields and simple `type` rules.
- Uploads are sanitized by converting objects through `JSON.parse(JSON.stringify(...))`.

## Migration
Run `node server/scripts/migrateFormTemplates.js` to snapshot existing JSON templates and tag existing case form data with version `1`.
