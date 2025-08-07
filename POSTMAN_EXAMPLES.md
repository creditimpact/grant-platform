# Postman Test Examples

## Register
```http
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret123"
}
```

## Login
```http
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "secret123"
}
```

## Protected Route
```http
GET http://localhost:5000/api/users
Authorization: Bearer <JWT_TOKEN>
```

## Upload PNG Document
```http
POST http://localhost:5000/api/files/upload
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
file: <path to your file.png>
key: id_document
```

## Save Questionnaire
```http
POST http://localhost:5000/api/case/questionnaire
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
POST http://localhost:4001/check
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
POST http://localhost:4001/check
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
POST http://localhost:4001/check
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
POST http://localhost:4001/check
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
