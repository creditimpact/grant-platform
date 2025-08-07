# Grant Eligibility Engine

This package contains a lightweight rules engine used to determine business eligibility for a variety of grant and credit programs. Grants are defined as JSON files under `grants/` so new programs can be added without touching the code.

Included templates now cover federal and local programs like the **Business Tax Refund Grant** alongside R&D credits and city incentives.

## Running the Engine

Install dependencies (FastAPI is only required for the optional API service):

```bash
pip install -r requirements.txt  # if running outside Codex environment
```

Run a sample eligibility check using the CLI helper:

```bash
python run_check.py test_payload.json
```

### Scoring & Explanations

Each grant is evaluated against its rules. Passing all rules yields a score of 100%. Missing data returns a score of 0 with `eligible` set to `null`. Partial matches receive a proportional score so results can be ranked by best fit.

### API Service

Start the FastAPI service to expose the engine over HTTP:

```bash
uvicorn api:app --reload --port 4001
```

Available endpoints:

- `POST /check` – submit user data and receive eligibility results.
- `GET /grants` – list available grant configurations.
- `GET /grants/{key}` – retrieve a specific grant definition.

The API includes automatic OpenAPI docs at `/docs` when running.

## Adding New Grants

1. Create a JSON file in `grants/` following the existing examples. Include:
   - `name`, `year`, and `description`.
   - `required_fields` a list of data keys needed.
   - `eligibility_rules` describing the logic. Supports `any_of`, `all_of`, range checks, and conditional blocks.
   - `estimated_award` describing how to calculate the potential amount.
   - `tags` and `ui_questions` to help the UI.
2. The file name becomes the grant `key` used by the API.

## Sample Payload

See `test_payload.json` for a sample business profile. Running the engine with this payload returns a scored list of grants:

```json
[
  {
    "name": "Minority Female Founder Grant",
    "eligible": true,
    "score": 100,
    "estimated_amount": 20000,
    "reasoning": ["✅ owner_gender = female, expected female", "✅ owner_minority = True, expected True"],
    "debug": {
      "checked_rules": {"owner_gender": {"value": "female", "expected": "female"}},
      "missing_fields": []
    }
  },
  {
    "name": "Tech Startup Payroll Credit",
    "eligible": null,
    "score": 0,
    "estimated_amount": 0,
    "reasoning": ["Missing required fields: ['startup_year', 'payroll_total']"],
    "debug": {"checked_rules": {}, "missing_fields": ["startup_year", "payroll_total"]}
  }
]
```

Each grant is assigned a percentage score based on how many rules passed. Missing data results in `eligible: null` and a score of 0. The `reasoning` and `debug` fields explain exactly why a grant did or did not qualify.

## Testing

```bash
python -m pytest
```
