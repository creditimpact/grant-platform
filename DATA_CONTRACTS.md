# Canonical Data Contracts

This document defines the canonical schema for fields produced by the AI Analyzer and consumed by the Eligibility Engine. It provides a single source of truth so developers and tests stay aligned.

## Supported Upload Formats

Both the Server API and AI Analyzer accept the following file extensions: `.pdf`, `.docx`, `.txt`, `.png`, `.jpeg`, `.jpg`, `.bmp`.

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
| revenue_drop_2020_percent | float | Revenue drop in 2020 | Accept 0‑100; strip `%`; store as float | No | `40.0` | Field Map |
| revenue_drop_2021_percent | float | Revenue drop in 2021 | Accept 0‑100; strip `%`; store as float | No | `25.0` | Field Map |
| revenue_drop_percent | float | Overall revenue drop used for ERC | Accept 0‑100; strip `%`; store as float | Yes | `30.0` | Field Map |
| rural_area | boolean | Located in a rural area | Parse yes/no | Yes | `false` | Field Map |
| service_area_population | integer | Population of service area | Convert to integer \>=0 | No | `25000` | Field Map |
| some_date | string | Generic date placeholder | ISO‑8601 date | No | `"2024-01-31"` | Field Map |
| w2_employee_count | integer | Count of W‑2 employees | Convert to integer \>=0 | Yes | `25` | Both |
| w2_part_time_count | integer | Number of part‑time W‑2 employees | Convert to integer \>=0 | No | `5` | Field Map |
| quarterly_revenues | mapping | Nested map of yearly and quarterly revenues | Keys `YYYY` -> `Q1..Q4`; amounts normalized as currency | No | `{ "2023": { "Q1": 10000 } }` | Analyzer |
| year_founded | integer | Year the company was founded | Accept 1800..current year | No | `2008` | Analyzer |
| minority_owned | boolean | Business identified as minority‑owned | Parse yes/no | No | `true` | Analyzer |
| female_owned | boolean | Business identified as woman‑owned | Parse yes/no | No | `true` | Analyzer |
| intended_categories | array | Planned categories for grant funds | Lowercase strings | No | `["payroll", "rent"]` | Analyzer |
| justification | string | Rationale for using funds | Trim whitespace | No | `Retain staff` | Analyzer |
| date_signed | date | Date the statement was signed | ISO-8601 date | No | `2024-01-01` | Analyzer |
| ppp_reference | boolean | PPP loan is referenced in documents | Parse yes/no | No | `true` | Analyzer |
| ertc_reference | boolean | ERTC reference detected in documents | Parse yes/no | No | `true` | Analyzer |

## Field Synonyms & Canonical Keys

| Aliases | Canonical Key |
| --- | --- |
| `ein` | `employer_identification_number` |
| `employees` | `w2_employee_count` |
| `employee_count` | `number_of_employees` |
| `state`, `location_state` | `business_location_state` |
| `country`, `location_country` | `business_location_country` |
| `owner_is_veteran`, `veteran_owned` | `owner_veteran` |
| `owner_is_spouse` | `owner_spouse` |
| `revenue_drop_2020_pct` | `revenue_drop_2020_percent` |
| `revenue_drop_2021_pct` | `revenue_drop_2021_percent` |
| `shutdown_2020` | `government_shutdown_2020` |
| `shutdown_2021` | `government_shutdown_2021` |
| `ppp_double_dip` | `ppp_wages_double_dip` |
| `ownership_pct` | `ownership_percentage` |
| `biz_type` | `business_type` |
| `economically_vulnerable` | `economically_vulnerable_area` |

## Analyzer-Only Fields

All fields currently emitted by the AI Analyzer are represented in `field_map.json`.

## Discrepancies and Notes

* **Engine-only fields:** Some canonical fields such as `gov_shutdown` are defined in `field_map.json` but are not currently produced by the analyzer.

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
  "revenue_drop_percent": 35.0,
  "gov_shutdown": false,
  "owner_veteran": true,
  "ownership_percentage": 100,
  "received_ppp": true,
  "ppp_wages_double_dip": false,
  "rural_area": false,
  "opportunity_zone": true,
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
