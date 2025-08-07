# Grant Eligibility Engine

This package contains a lightweight rules engine used to determine business eligibility for a variety of grant and credit programs. Grants are defined as JSON files under `grants/` so new programs can be added without touching the code.

Included templates now cover federal and local programs like the **Business Tax Refund Grant**, the **Women-Owned Tech Grant**, the **Minority Female Founder Grant**, and the **Rural Development Grant** with multiple USDA sub-programs.

## Tech Startup Payroll Credit

The Tech Startup Payroll Credit allows qualified small businesses to apply a portion of their R&D credit against payroll taxes. To qualify, a company must have less than $5 million in gross receipts, be in operation for five years or less, and meet the IRS four-part R&D test (technological uncertainty, experimentation, and scientific/engineering process). The credit is elected on **Form 6765** and claimed on **Forms 8974** and **941** starting the quarter after the election. Unused amounts automatically carry forward to future quarters up to an annual cap of $500,000.

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
   - Either `eligibility_rules` or `eligibility_categories` describing the logic. Categories allow separate rule blocks (e.g. WOSB vs. SBIR requirements).
   - Rule keys ending in `_min`/`_max` compare numbers. Keys ending in `_each_min`/`_each_max` ensure all values in a list meet the threshold.
   - `estimated_award` describing how to calculate the potential amount.
   - `tags` and `ui_questions` to help the UI.
2. The file name becomes the grant `key` used by the API.

## Women-Owned Tech Grant

The Women-Owned Tech Grant demonstrates the new grouped rule logic. Its configuration lives at `grants/women_owned_tech.json` and defines three categories:

- **WOSB** – verifies small business status, majority U.S.‑citizen women ownership and control, for‑profit structure, and U.S. presence.
- **EDWOSB** – adds economic disadvantage checks ensuring each woman owner's net worth, income, and assets fall below program limits.
- **SBIR/STTR** – enforces research program rules including U.S. ownership, employee limits, domestic research, partner requirements for STTR, and federal registrations.

Each category is evaluated separately and aggregated into an overall eligibility result.

## Sample Payload

See `test_payload.json` for a sample business profile. Running the engine with this payload returns a scored list of grants:

```json
[
  {
    "name": "Minority Female Founder Grant",
    "eligible": true,
    "score": 100,
    "estimated_amount": 20000,
    "reasoning": [
      "[ownership_and_control] ✅ owner_gender = female, expected female",
      "[ownership_and_control] ✅ ownership_percentage = 60, expected >= 51",
      "[business_size] ✅ number_of_employees = 5, expected <= 50",
      "[business_age] ✅ business_age_years = 2, expected >= 0.5"
    ],
    "debug": {
      "groups": {
        "ownership_and_control": {"missing_fields": []},
        "location": {"missing_fields": []},
        "business_size": {"missing_fields": []},
        "business_age": {"missing_fields": []}
      },
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
