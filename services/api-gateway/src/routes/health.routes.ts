import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok", service: "api-gateway" }));
  app.get("/ready", async () => ({ ready: true, service: "api-gateway" }));
  app.get("/healthz", async () => ({ ok: true, service: "api-gateway" }));
  app.get("/readyz", async () => ({ ready: true, service: "api-gateway" }));
}
