# AI Agent Microservice

This service provides OCR-based document analysis, eligibility checks using the
existing `eligibility-engine`, and simple grant form filling. It is designed as a
future foundation for chatbot or cockpit style integrations.

## Running

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Secrets are loaded from Vault. Set `VAULT_ADDR`, `VAULT_TOKEN` (for local
testing) and `VAULT_SECRET_PATH` to point at a KV v2 location containing values
such as `MONGO_URI`, `MONGO_USER`, `MONGO_PASS`, `MONGO_CA_FILE` and
`OPENAI_API_KEY`.

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

## Safe Expression Evaluation

Computed, conditional and visibility rules inside form templates are expressed
using a very small subset of Python. These expressions are evaluated with a
custom AST-based interpreter that supports arithmetic, boolean logic and
comparisons while restricting function calls to a tiny whitelist (`int` and
`float`).  Any invalid or malicious expression is rejected, preventing arbitrary
code execution and keeping template evaluation safe. The evaluator now also
sanitizes the context, rejecting variable names containing double underscores or
values that are callable to block access to dangerous objects. In addition,
limits on expression complexity (maximum AST nodes) and constant size (maximum
string length and numeric magnitude) prevent resource exhaustion attacks. These
limits can be tuned via optional arguments to ``safe_eval`` if stricter or more
lenient behavior is desired.

## Testing Documents

Example documents live under `test_documents/`. They are simple text files used
by the demo OCR parser.

## Future GPT/LLM Capabilities

The service includes helper functions for semantic inference and session
tracking so a future LLM can generate summaries, request additional documents or
even create dashboard tickets automatically.
