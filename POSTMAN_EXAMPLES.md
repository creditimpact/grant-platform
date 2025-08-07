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
