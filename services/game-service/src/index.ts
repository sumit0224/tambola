import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { redisPublisher, redisSubscriber, disconnectRedis } from "@tambola/redis";
import { buildGameRoutes } from "./routes/game.routes";
import { buildClaimRoutes } from "./routes/claim.routes";
import { SocketHandler } from "./socket/SocketHandler";
import { socketAuth } from "./socket/socketAuth.middleware";
import { AppError } from "./common/errors";
import { GameApiService } from "./services/GameApiService";

async function bootstrap() {
  const app = Fastify({ logger: true, trustProxy: true });
  const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000,https://tambola.vercel.app")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  await app.register(cors, { origin: corsOrigins, credentials: true });
  await app.register(helmet);
  await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });

  app.get("/health", async () => ({ status: "ok", service: "game-service" }));
  app.get("/ready", async () => ({ ready: true, service: "game-service" }));

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send(error.toResponseBody());
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

  const io = new SocketIOServer(app.server, {
    cors: { origin: corsOrigins, credentials: true }
  });

  const pubClient = redisPublisher.duplicate();
  const subClient = redisSubscriber.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  io.use(socketAuth);

  const gameApi = new GameApiService(io);

  await app.register(buildGameRoutes(gameApi), { prefix: "/v1" });
  await app.register(buildClaimRoutes(gameApi), { prefix: "/v1" });

  new SocketHandler(gameApi).initialize(io);

  const shutdown = async () => {
    io.close();
    await app.close();
    await Promise.all([pubClient.quit().catch(() => undefined), subClient.quit().catch(() => undefined)]);
    await disconnectRedis().catch(() => undefined);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  const port = Number(process.env.PORT || 3000);
  await app.listen({ port, host: "0.0.0.0" });
}

void bootstrap();
