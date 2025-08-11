let sdk;
function init() {
  if (process.env.OTEL_ENABLED === 'true') {
    try {
      const { NodeSDK } = require('@opentelemetry/sdk-node');
      const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
      const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
      const { Resource } = require('@opentelemetry/resources');
      const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
      const pkg = require('../package.json');
      const exporter = new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
      });
      sdk = new NodeSDK({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: 'grant-platform-api',
          [SemanticResourceAttributes.SERVICE_VERSION]: pkg.version,
        }),
        traceExporter: exporter,
        instrumentations: [getNodeAutoInstrumentations()],
      });
      sdk.start();
    } catch (e) {
      console.error('OTEL init failed', e);
    }
  }
}
module.exports = { init };
