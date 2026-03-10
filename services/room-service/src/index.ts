import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { roomRoutes } from "./routes/room.routes";
import { disconnectPrisma } from "@tambola/db";
import { disconnectRedis } from "@tambola/redis";

async function bootstrap() {
  const app = Fastify({ logger: true, trustProxy: true });
  const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000,https://tambola.vercel.app")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  await app.register(cors, { origin: corsOrigins, credentials: true });
  await app.register(helmet);
  await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });

  app.get("/health", async () => ({ status: "ok", service: "room-service" }));
  app.get("/ready", async () => ({ ready: true, service: "room-service" }));

  await app.register(async (v1) => {
    await v1.register(roomRoutes);
  }, { prefix: "/v1" });

  const shutdown = async () => {
    await app.close();
    await disconnectPrisma().catch(() => undefined);
    await disconnectRedis().catch(() => undefined);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  const port = Number(process.env.PORT || 3000);
  await app.listen({ port, host: "0.0.0.0" });
}

void bootstrap();
