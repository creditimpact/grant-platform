# AI Agent Microservice

This service provides OCR-based document analysis, eligibility checks using the
existing `eligibility-engine`, and simple grant form filling. It is designed as a
future foundation for chatbot or cockpit style integrations.

## Running

```bash
uvicorn main:app --reload
```

## Endpoints

- `POST /check` – submit user data or an uploaded document. Data is merged and
  evaluated with the eligibility engine.
- `POST /form-fill` – provide a grant key and user data to receive a filled form
  from `form_templates/`.
- `POST /chat` – placeholder endpoint for future LLM powered conversations.

## Adding Forms

Add a new JSON file under `form_templates/` using the existing examples as a
starting point. The `fields` object will be merged with user data.

## Testing Documents

Example documents live under `test_documents/`. They are simple text files used
by the demo OCR parser.

## Future GPT/LLM Capabilities

The API responses include placeholder `llm_summary` and `reasoning_steps` fields
ready for richer explanations from a language model.
