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

When enabled, visit `/metrics` on each service for Prometheus metrics. Traces are sent to the OTLP endpoint.
