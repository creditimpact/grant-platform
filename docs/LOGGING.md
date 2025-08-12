# Secure Logging Practices

The platform uses centralized loggers for all services. These loggers automatically redact sensitive fields (password, token, email, name, address, phone, IP) and hash IP addresses. To keep logs safe:

- **Never** log full request bodies or user supplied content. Log only high level metadata such as field names or counts.
- Use the provided logger modules instead of `console.log` or `print`.
- Error messages from external services should be truncated to avoid leaking PII.
- Debug endpoints like `/llm-debug/{session_id}` are disabled by default and require both authentication and an `ENABLE_DEBUG=true` environment flag.
- Production environments should run with info logs suppressed. Set `LOG_LEVEL` to increase verbosity only when needed.
- Client-side code uses a `safeLog` helper that truncates payloads in non-production
  builds to prevent leaking sensitive data to browser consoles.

Adhering to a formal logging policy helps ensure consistent, privacy‑preserving output across the system.
