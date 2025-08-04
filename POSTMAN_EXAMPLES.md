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
