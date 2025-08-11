# Security Migration Plan

This document summarizes the steps required to migrate existing deployments to the hardened security model implemented in this repository.

## JWT to Cookies
1. Deploy new backend that issues `accessToken` (10 min) and `refreshToken` (7 days) cookies marked `HttpOnly`, `Secure`, and `SameSite=Strict`.
2. Frontend requests must be sent with `credentials: 'include'`.
3. Remove any localStorage usage for authentication.
4. Provide `/api/auth/refresh` and `/api/auth/logout` endpoints for token rotation and revocation.

## CSRF Protection
1. On login/refresh the server sets a `csrfToken` cookie.
2. Frontend reads this cookie and sends the value in the `X-CSRF-Token` header for non-GET requests.
3. Server validates the cookie/header pair and also checks the `Origin`/`Referer` headers.

## Rate Limiting
- Global: 1000 req/IP/hour.
- API: 60 req/IP/min.
- Login: 5 req/IP/min.
- Register: 3 req/IP/min.

## Validation
- Requests validated with schema definitions enforcing type, length and format.

## Security Headers / CSP / SRI
```js
res.setHeader('Content-Security-Policy', "default-src 'self'");
res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('Referrer-Policy', 'no-referrer');
```

Example SRI for external scripts:
```html
<script src="https://cdn.example.com/lib.js" integrity="sha384-BASE64HASH" crossorigin="anonymous"></script>
```

Ensure HTTPS is enforced in production and enable dependency scanners (e.g. `npm audit`, `snyk`) in CI.
