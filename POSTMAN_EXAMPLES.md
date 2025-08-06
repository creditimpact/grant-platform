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
  "zip": "10001",
  "locationZone": "urban",
  "entityType": "LLC",
  "ein": "12-3456789",
  "incorporationDate": "2020-01-01",
  "dateEstablished": "2019-06-01",
  "annualRevenue": 500000,
  "netProfit": 80000,
  "employees": 5,
  "ownershipPercent": 100,
  "previousGrants": false,
  "cpaPrepared": true
}
```
