# Security Patch Notes

## Sensitive Data Logging
- **Files:** `server/routes/case.js`, `server/routes/pipeline.js`, `server/utils/logger.js`, `server/utils/validation.js`, `frontend/src/app/dashboard/questionnaire/page.tsx`, `frontend/src/hooks/useAuth.ts`
- **Fix:** Replaced raw `console` statements with centralized logger and dev-only logging; masked PII and removed sensitive payloads.
- **Rationale:** Prevents exposure of PII in logs while retaining debug capability in development.
- **Configuration:** No additional steps.

## User Enumeration via /api/users
- **Files:** `server/routes/users.js`
- **Fix:** Endpoint now returns only the authenticated user's profile.
- **Rationale:** Avoids disclosure of other user records.
- **Configuration:** No additional steps.

## CSRF Exemptions on Auth Routes
- **Files:** `server/middleware/csrf.js`, `server/routes/auth.js`, `frontend/src/hooks/useAuth.ts`, `server/tests/auth.test.js`
- **Fix:** Removed CSRF exemptions; added `/api/auth/csrf-token` route; frontend fetches token before login/register.
- **Rationale:** Ensures all state-changing requests include valid CSRF tokens.
- **Configuration:** Clients must call `/api/auth/csrf-token` before auth requests.

## Logout Cookie Clearing
- **Files:** `server/routes/auth.js`
- **Fix:** Cookies cleared with original `HttpOnly`, `Secure`, and `SameSite` flags.
- **Rationale:** Guarantees browsers delete auth cookies consistently.
- **Configuration:** No additional steps.

## Public Access to Uploads
- **Files:** `server/index.js`, `server/routes/case.js`
- **Fix:** Removed static `/uploads` serving; added authenticated `/api/files/:filename` route with ownership checks.
- **Rationale:** Prevents unauthenticated access to uploaded documents.
- **Configuration:** No additional steps.

## Missing Schema Validation
- **Files:** `server/middleware/validate.js`, `server/routes/case.js`, `server/routes/pipeline.js`
- **Fix:** Added schema validation for case, file upload, eligibility report, and pipeline submission endpoints.
- **Rationale:** Ensures strict request validation beyond custom logic.
- **Configuration:** No additional steps.

## Non-Resilient Rate Limiting
- **Files:** `server/middleware/rateLimit.js`
- **Fix:** Introduced Redis-backed rate limiting with in-memory fallback.
- **Rationale:** Provides scalable rate limiting across instances with persistence.
- **Configuration:** Set `REDIS_URL` to enable shared store.

