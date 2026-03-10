import { diag, DiagConsoleLogger, DiagLogLevel, type Span, trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | null = null;

export async function initTracing(serviceName: string, input: { endpoint?: string; enabled?: boolean } = {}) {
  const enabled = input.enabled ?? true;
  if (!enabled || sdk) {
    return;
  }

  if (process.env.OTEL_DEBUG === "1") {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  }

  const exporter = new OTLPTraceExporter({
    url: input.endpoint ?? process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  });

  sdk = new NodeSDK({
    traceExporter: exporter,
    instrumentations: [getNodeAutoInstrumentations()],
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName
    })
  });

  await sdk.start();
}

export async function shutdownTracing() {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  sdk = null;
}

export async function withSpan<T>(serviceName: string, spanName: string, fn: (span: Span) => Promise<T>): Promise<T> {
  const tracer = trace.getTracer(serviceName);

  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      const result = await fn(span);
      span.end();
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.end();
      throw error;
    }
  });
}
