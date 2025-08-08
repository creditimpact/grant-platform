# Postman Test Examples

## Register
```http
POST https://localhost:5000/api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret123"
}
```

## Login
```http
POST https://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "secret123"
}
```

## Protected Route
```http
GET https://localhost:5000/api/users
Authorization: Bearer <JWT_TOKEN>
```

## Upload PNG Document
```http
POST https://localhost:5000/api/files/upload
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
file: <path to your file.png>
key: id_document
```

## Save Questionnaire
```http
POST https://localhost:5000/api/case/questionnaire
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "businessName": "Tech Co",
  "phone": "555-1234",
  "email": "owner@example.com",
  "address": "1 Main St",
  "city": "Metropolis",
  "state": "NY",
  "zipCode": "10001",
  "locationZone": "urban",
  "businessType": "LLC",
  "incorporationDate": "2019-06-01",
  "businessEIN": "12-3456789",
  "annualRevenue": 500000,
  "netProfit": 80000,
  "numberOfEmployees": 5,
  "ownershipPercentage": 100,
  "businessIncome": 550000,
  "businessExpenses": 520000,
  "taxPaid": 20000,
  "taxYear": 2024,
  "previousRefundsClaimed": false,
  "previousGrants": false
}
```

*The API also accepts legacy fields `entityType`, `employees`, `ownershipPercent` and `dateEstablished`. Dates may be sent in `YYYY-MM-DD` (preferred) or `MM/DD/YYYY` formats.*

## Veteran Owned Business Grant Example
```http
POST https://localhost:4001/check
Content-Type: application/json

{
  "owner_veteran": true,
  "owner_spouse": false,
  "ownership_percentage": 60,
  "number_of_employees": 10,
  "annual_revenue": 3000000,
  "business_location_state": "TX",
  "economically_vulnerable_area": true,
  "business_type": "llc"
}
```

Sample response:

```json
{
  "name": "Veteran Owned Business Grant",
  "eligible": true,
  "estimated_amount": 10000
}
```

## Tech Startup Payroll Credit Example

```http
POST https://localhost:4001/check
Content-Type: application/json

{
  "gross_receipts": 3000000,
  "years_active": 3,
  "technological_uncertainty": true,
  "experimental_process": true,
  "scientific_process": true,
  "rd_credit_amount": 150000,
  "payroll_tax_liability": 120000,
  "carryforward_credit": 0,
  "election_filing_quarter": 1,
  "current_quarter": 2,
  "tax_year": 2023
}
```

Sample response:

```json
{
  "name": "Tech Startup Payroll Credit",
  "eligible": true,
  "estimated_amount": 120000,
  "debug": {"award": {"carryforward": 30000}}
}
```

## Rural Development Grant Example

```http
POST https://localhost:4001/check
Content-Type: application/json

{
  "entity_type": "municipality",
  "service_area_population": 4000,
  "income_level": "low",
  "project_type": "community_facilities",
  "project_cost": 100000
}
```

Sample response:

```json
{
  "name": "Rural Development Grant",
  "eligible": true,
  "estimated_amount": 75000
}
```

## Green Energy State Incentive Example
```http
POST https://localhost:4001/check
Content-Type: application/json

{
  "state": "NY",
  "applicant_type": "business",
  "project_type": "pv",
  "project_cost": 600000,
  "system_size_kw": 500,
  "certified_installer": true,
  "approved_equipment": true,
  "equity_eligible_contractor": true
}
```

Sample response:
```json
{
  "name": "Green Energy State Incentive",
  "eligible": true,
  "estimated_amount": 500000
}
```

## Urban Small Business Grants (2025) Example
```http
POST https://localhost:4001/check
Content-Type: application/json

{
  "city": "Chicago",
  "employee_count": 3,
  "annual_revenue": 150000,
  "revenue_decline_percent": 40,
  "business_age_years": 2,
  "industry": "retail",
  "owner_veteran": false,
  "owner_minority": false,
  "covid_impact": true,
  "structural_damage": false,
  "geographic_zone": "south"
}
```

Sample response:
```json
{
  "name": "Urban Small Business Grants (2025)",
  "eligible": true,
  "estimated_amount": 5000
}
```

## California Small Business Grant (2025) Example
```http
POST https://localhost:4001/check
Content-Type: application/json

{
  "business_location_state": "CA",
  "number_of_employees": 4,
  "annual_revenue": 500000,
  "registration_year": 2021,
  "owner_state": "CA",
  "sbtaep_training_complete": true,
  "certified_center_approval": true,
  "net_income": 100000,
  "business_age_years": 2,
  "us_content_percent": 0,
  "sba_standard_compliant": false,
  "city": "Los Angeles",
  "women_owned": false,
  "technical_assistance_complete": false,
  "route_66_location": false,
  "industry": "technology",
  "project_type": "other",
  "ust_owner_operator": false,
  "annual_fuel_sales_gallons": 0,
  "health_safety_compliant": false,
  "chamber_nomination": false,
  "county": "Other",
  "low_income_community": false,
  "disaster_affected": false
}
```

Sample response:
```json
{
  "name": "California Small Business Grant (2025)",
  "eligible": true,
  "estimated_amount": 10000
}
```

## Employee Retention Credit Example
```http
POST https://localhost:4001/check
Content-Type: application/json

{
  "business_location_country": "US",
  "w2_employee_count": 5,
  "revenue_drop_2020_percent": 55,
  "government_shutdown_2021": true,
  "qualified_wages_2020": 10000,
  "qualified_wages_2021": 10000,
  "ppp_wages_double_dip": false
}
```

Sample response:
```json
{
  "name": "Employee Retention Credit",
  "eligible": true,
  "estimated_amount": 7000
}
```
