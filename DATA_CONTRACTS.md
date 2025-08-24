# Canonical Data Contracts

This document defines the canonical schema for fields produced by the AI Analyzer and consumed by the Eligibility Engine. It provides a single source of truth so developers and tests stay aligned.

## Canonical Fields

The following table enumerates all canonical keys understood by the eligibility engine. Each field lists its data type, normalization rules, whether it is required by any grant program, and where it currently originates.

| Field | Type | Description | Normalization | Required | Example | Source |
| --- | --- | --- | --- | --- | --- | --- |
| annual_revenue | integer | Total gross revenue for the most recent year | Strip `$`/`,` and store whole USD | Yes | `850000` | Both |
| bool_no | boolean | Convenience flag always set to `false` | Literal `false` | No | `false` | Field Map |
| bool_yes | boolean | Convenience flag always set to `true` | Literal `true` | No | `true` | Field Map |
| business_location_country | string | Country where business operates | Map to uppercase ISO‑2 code | No | `"US"` | Both |
| business_location_state | string | State where business operates | Map names to two‑letter abbreviation | Yes | `"CA"` | Both |
| business_type | string | Industry or NAICS style label | Lowercase string | Yes | `"retail"` | Field Map |
| economically_vulnerable_area | boolean | Located in economically vulnerable area | Parse yes/no | No | `false` | Field Map |
| employer_identification_number | string | IRS EIN for the business | Strip non‑digits and format `NN‑NNNNNNN` | No | `"12-3456789"` | Both |
| entity_type | string | Legal entity structure | Normalize to codes (e.g., `llc`, `corp_s`) | Yes | `"llc"` | Both |
| gov_shutdown | boolean | Government shutdown affected operations | Parse yes/no | Yes | `true` | Field Map |
| government_shutdown_2020 | boolean | Shutdown occurred in 2020 | Parse yes/no | No | `false` | Field Map |
| government_shutdown_2021 | boolean | Shutdown occurred in 2021 | Parse yes/no | No | `false` | Field Map |
| income_level | string | Income level of service area | Lowercase string | No | `"low"` | Field Map |
| number_of_employees | integer | Total employees (all types) | Convert to integer \>=0 | Yes | `50` | Field Map |
| opportunity_zone | boolean | Business in a federal Opportunity Zone | Parse yes/no | No | `true` | Field Map |
| owner_spouse | boolean | Owner has spouse as co‑owner | Parse yes/no | No | `false` | Field Map |
| owner_spouse_veteran | boolean | Owner's spouse is a veteran | Parse yes/no | Yes | `true` | Field Map |
| owner_veteran | boolean | Business owner is a veteran | Parse yes/no | Yes | `true` | Field Map |
| ownership_percentage | integer | Percent of business owned by applicant | Accept 0‑100; strip `%` | Yes | `100` | Field Map |
| payroll_total | integer | Company-wide payroll for the most recent year | Remove `$`, commas, parentheses; expand `k/m`; store whole USD | No | `1234567` | Field Map |
| ppp_wages_double_dip | boolean | PPP wages reused for credits | Parse yes/no | No | `false` | Field Map |
| project_cost | integer | Cost of proposed project | Strip `$`/`,` and store whole USD | Yes | `250000` | Field Map |
| project_type | string | Type of project (e.g., solar, r&D) | Lowercase string | Yes | `"solar_installation"` | Field Map |
| qualified_wages_2020 | integer | Qualified wages for 2020 | Strip `$`/`,` and store whole USD | No | `150000` | Field Map |
| qualified_wages_2021 | integer | Qualified wages for 2021 | Strip `$`/`,` and store whole USD | No | `200000` | Field Map |
| received_ppp | boolean | Business received a PPP loan | Parse yes/no | No | `true` | Field Map |
| revenue_drop_2020_percent | integer | Revenue drop in 2020 | Accept 0‑100; strip `%` | No | `40` | Field Map |
| revenue_drop_2021_percent | integer | Revenue drop in 2021 | Accept 0‑100; strip `%` | No | `25` | Field Map |
| revenue_drop_percent | integer | Overall revenue drop used for ERC | Accept 0‑100; strip `%` | Yes | `30` | Field Map |
| rural_area | boolean | Located in a rural area | Parse yes/no | Yes | `false` | Field Map |
| service_area_population | integer | Population of service area | Convert to integer \>=0 | No | `25000` | Field Map |
| some_date | string | Generic date placeholder | ISO‑8601 date | No | `"2024-01-31"` | Field Map |
| w2_employee_count | integer | Count of W‑2 employees | Convert to integer \>=0 | Yes | `25` | Both |
| w2_part_time_count | integer | Number of part‑time W‑2 employees | Convert to integer \>=0 | No | `5` | Field Map |

## Analyzer-Only Fields

These fields are currently emitted by the AI Analyzer but are not mapped in `field_map.json`.

| Field | Type | Description | When Populated | Example |
| --- | --- | --- | --- | --- |
| quarterly_revenues | object | Nested map of yearly and quarterly revenues | When specific quarter revenue amounts are detected | `{ "2020": { "Q1": 10000 } }` |
| year_founded | integer | Year the company was founded | When founding year is mentioned | `2008` |
| minority_owned | boolean | Business identified as minority‑owned | When text mentions minority ownership | `true` |
| female_owned | boolean | Business identified as woman‑owned | When text mentions female ownership | `true` |
| veteran_owned | boolean | Business identified as veteran‑owned | When text mentions veteran ownership | `false` |
| ppp_reference | boolean | PPP loan is referenced in documents | When OCR finds PPP keywords | `true` |
| ertc_reference | boolean | ERTC is referenced in documents | When OCR finds ERTC keywords | `true` |

## Discrepancies and Notes

* **Analyzer-only fields:** The analyzer emits `quarterly_revenues`, `year_founded`, `minority_owned`, `female_owned`, `veteran_owned`, `ppp_reference`, and `ertc_reference`, but these do not appear in `field_map.json`. If the eligibility engine needs them, they should be added to the field map.
* **Engine-only fields:** Many canonical fields such as `gov_shutdown`, `revenue_drop_percent`, and ownership attributes are defined in `field_map.json` but are not currently produced by the analyzer.

### Optional and Secondary Fields

Fields like `ppp_reference`, `ertc_reference`, `government_shutdown_2020`, `government_shutdown_2021`, and `year_founded` are populated only when the analyzer detects explicit cues in the source documents. Their absence should be treated as "unknown" rather than `false`.

## Example Normalized Output

```json
{
  "employer_identification_number": "12-3456789",
  "w2_employee_count": 42,
  "annual_revenue": 850000,
  "business_location_state": "CA",
  "business_location_country": "US",
  "entity_type": "llc",
  "revenue_drop_percent": 35,
  "gov_shutdown": false,
  "owner_veteran": true,
  "ownership_percentage": 100,
  "received_ppp": true,
  "ppp_reference": true,
  "quarterly_revenues": {
    "2020": { "Q1": 200000, "Q2": 150000 },
    "2021": { "Q1": 220000 }
  },
  "female_owned": true,
  "minority_owned": false
}
```

This sample shows analyzer output after normalization to canonical keys.
