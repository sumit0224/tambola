import type { FastifyInstance } from "fastify";
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
  contentType,
  register as globalRegister
} from "prom-client";

type Metrics = {
  registry: Registry;
  socketConnections: Gauge<string>;
  socketEvents: Counter<string>;
  broadcastLatencyMs: Histogram<string>;
  claimLatencyMs: Histogram<string>;
};

const instances = new Map<string, Metrics>();

export function getServiceMetrics(serviceName: string): Metrics {
  const existing = instances.get(serviceName);
  if (existing) {
    return existing;
  }

  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: `${serviceName.replace(/-/g, "_")}_` });

  const socketConnections = new Gauge({
    name: `${serviceName.replace(/-/g, "_")}_socket_connections`,
    help: "Current socket connections",
    registers: [registry]
  });

  const socketEvents = new Counter({
    name: `${serviceName.replace(/-/g, "_")}_socket_events_total`,
    help: "Total handled socket events",
    labelNames: ["event"] as const,
    registers: [registry]
  });

  const broadcastLatencyMs = new Histogram({
    name: `${serviceName.replace(/-/g, "_")}_broadcast_latency_ms`,
    help: "Socket broadcast latency in milliseconds",
    labelNames: ["event"] as const,
    buckets: [5, 10, 25, 50, 100, 200, 500, 1000],
    registers: [registry]
  });

  const claimLatencyMs = new Histogram({
    name: `${serviceName.replace(/-/g, "_")}_claim_latency_ms`,
    help: "Time to validate claim in milliseconds",
    buckets: [10, 25, 50, 100, 250, 500, 1000, 2500],
    registers: [registry]
  });

  const metrics = {
    registry,
    socketConnections,
    socketEvents,
    broadcastLatencyMs,
    claimLatencyMs
  };

  instances.set(serviceName, metrics);
  return metrics;
}

export function registerMetricsEndpoint(app: FastifyInstance, serviceName: string, path = "/metrics") {
  const metrics = getServiceMetrics(serviceName);

  app.get(path, async (_request, reply) => {
    reply.header("Content-Type", contentType);
    return metrics.registry.metrics();
  });
}

export function resetGlobalMetrics(): void {
  globalRegister.clear();
  instances.clear();
}
