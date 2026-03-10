import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/healthz", async () => ({ ok: true, service: "game-orchestrator" }));
  app.get("/readyz", async () => ({ ready: true, service: "game-orchestrator" }));
}
