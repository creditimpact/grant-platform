# Logging and Monitoring

All services use a shared JSON logger that writes structured logs to STDOUT. Logs are intended to be collected by a centralized system (e.g. ELK, Graylog).

## Sensitive Data Handling
- Fields such as `password`, `token`, and `apiKey` are automatically redacted and appear as `[REDACTED]`.
- Services should avoid logging raw request bodies or other PII.

## Audit Trails
- Authentication events (success and failure) are logged with the `audit` level and include the client IP and user identity when available.
- Audit logs are immutable once shipped to the centralized collector.

## Monitoring and Alerts
- Monitor counts of `auth.login.failure` and other audit events to detect suspicious activity.
- Example alert rule (pseudo‑YAML):
  ```yaml
  - alert: ExcessiveLoginFailures
    condition: count_over_time(logs{message="auth.login.failure"}[5m]) > 10
    action: notify_security_team
  ```
- Dashboards should visualize authentication trends, error rates, and request volumes across services.

## Testing
- Unit tests assert that audit logs are emitted and sensitive data is redacted.
