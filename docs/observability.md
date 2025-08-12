# Observability

Enable metrics and tracing via environment variables:

```
export OBSERVABILITY_ENABLED=true
export PROMETHEUS_METRICS_ENABLED=true
export REQUEST_ID_ENABLED=true
export REQUEST_LOG_JSON=true
export OTEL_ENABLED=true
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

Set `METRICS_BASIC_AUTH` to a `user:password` pair to enable HTTP Basic authentication on the `/metrics` endpoint. Requests
without the correct credentials receive **401 Unauthorized**.

```bash
export METRICS_BASIC_AUTH=metrics:secret
curl -u metrics:secret http://localhost:5000/metrics
```

When enabled, scrape `/metrics` on each service for Prometheus metrics. Traces are sent to the OTLP endpoint.
