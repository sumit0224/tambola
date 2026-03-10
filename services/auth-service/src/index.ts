import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { authRoutes } from "./routes/auth.routes";
import { userRoutes } from "./routes/user.routes";
import { AppError } from "./common/errors";
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

  app.get("/health", async () => ({ status: "ok", service: "auth-service" }));
  app.get("/ready", async () => ({ ready: true, service: "auth-service" }));

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ error: error.code });
      return;
    }

    if (error instanceof ZodError) {
      reply.code(400).send({
        error: "VALIDATION_ERROR",
        details: error.flatten()
      });
      return;
    }

    const httpStatusCode = (error as { statusCode?: number }).statusCode;
    if (typeof httpStatusCode === "number" && httpStatusCode >= 400 && httpStatusCode < 500) {
      const responseCode = (error as { code?: string }).code ?? "REQUEST_ERROR";
      const responseMessage = error instanceof Error ? error.message : "Request failed";
      reply.code(httpStatusCode).send({
        error: responseCode,
        message: responseMessage
      });
      return;
    }

    app.log.error(error);
    reply.code(500).send({ error: "INTERNAL_SERVER_ERROR" });
  });

  await app.register(async (v1) => {
    await v1.register(authRoutes);
    await v1.register(userRoutes);
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
