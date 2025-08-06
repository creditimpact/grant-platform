# AI Agent Microservice

This service provides OCR-based document analysis, eligibility checks using the
existing `eligibility-engine`, and simple grant form filling. It is designed as a
future foundation for chatbot or cockpit style integrations.

## Running

```bash
uvicorn main:app --reload
```

## Endpoints

- `POST /check` – submit user data, notes or an uploaded document. Free-form
  text is semantically parsed and merged with the eligibility engine. Results
  include `llm_summary`, `clarifying_questions` and richer `reasoning_steps`.
- `POST /form-fill` – submit `form_name` and `user_payload` as JSON (top-level,
  no embedded wrapper) to receive a filled form from `form_templates/`.
  Conditional and computed fields will be evaluated.
- `POST /chat` – simple conversational endpoint that stores context in
  `session_id` records.

## Adding Forms

Add a new JSON file under `form_templates/` using the existing examples as a
starting point. The `fields` object will be merged with user data.

## Testing Documents

Example documents live under `test_documents/`. They are simple text files used
by the demo OCR parser.

## Future GPT/LLM Capabilities

The service includes helper functions for semantic inference and session
tracking so a future LLM can generate summaries, request additional documents or
even create dashboard tickets automatically.
