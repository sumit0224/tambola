import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { getRuntimeConfig } from "@tambola/config";
import { ClaimRepository, GameRepository, RoomRepository, UserRepository, disconnectPrisma } from "@tambola/db";
import { KafkaEventBus, NoopEventBus } from "@tambola/events";
import { registerMetricsEndpoint, initTracing, shutdownTracing, withSpan } from "@tambola/observability";
import { RateLimitService, RoomStateStore, disconnectRedis } from "@tambola/redis";
import { PasswordService, TokenService } from "@tambola/security";
import { buildAuthMiddleware } from "./middleware/auth.middleware";
import { buildAuthRoutes } from "./routes/auth.routes";
import { buildRoomRoutes } from "./routes/room.routes";
import { healthRoutes } from "./routes/health.routes";
import { AppError } from "./utils/AppError";
import { LegacyProxyService } from "./services/LegacyProxyService";
import { RoomBackboneService } from "./services/RoomBackboneService";
import { FraudScoringService } from "./fraud/FraudScoringService";

async function bootstrap() {
  const runtimeConfig = getRuntimeConfig(process.env);
  await initTracing("api-gateway");

  const app = Fastify({ logger: true, trustProxy: true });
  const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000,https://tambola.vercel.app")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  await app.register(cors, { origin: corsOrigins, credentials: true });
  await app.register(helmet);
  await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });
  registerMetricsEndpoint(app, "api_gateway");

  const userRepository = new UserRepository();
  const roomRepository = new RoomRepository();
  const gameRepository = new GameRepository();
  const claimRepository = new ClaimRepository();
  const roomStateStore = new RoomStateStore();
  const rateLimitService = new RateLimitService();
  const tokenService = new TokenService({
    issuer: runtimeConfig.env.JWT_ISSUER,
    audience: runtimeConfig.env.JWT_AUDIENCE,
    accessSecret: runtimeConfig.env.JWT_ACCESS_SECRET,
    refreshSecret: runtimeConfig.env.JWT_REFRESH_SECRET,
    accessTtlSeconds: runtimeConfig.env.ACCESS_TOKEN_TTL_SECONDS,
    refreshTtlSeconds: runtimeConfig.env.REFRESH_TOKEN_TTL_SECONDS
  });

  const eventBus = runtimeConfig.flags.useKafkaEvents
    ? new KafkaEventBus({
        clientId: `${runtimeConfig.env.KAFKA_CLIENT_ID}-api-gateway`,
        brokers: runtimeConfig.kafkaBrokers
      })
    : new NoopEventBus();

  await eventBus.connectProducer();
  if (runtimeConfig.flags.useKafkaEvents && runtimeConfig.env.NODE_ENV !== "production") {
    await eventBus.ensureTopics();
  }

  const legacyAuthProxy = new LegacyProxyService({
    baseUrl: process.env.LEGACY_AUTH_SERVICE_URL ?? "http://localhost:3001"
  });

  const legacyGameProxy = new LegacyProxyService({
    baseUrl: process.env.LEGACY_GAME_SERVICE_URL ?? "http://localhost:3003"
  });

  const roomBackboneService = new RoomBackboneService({
    roomRepository,
    gameRepository,
    claimRepository,
    userRepository,
    roomStateStore,
    eventBus,
    fraudScoringService: new FraudScoringService(claimRepository),
    snapshotEveryEvents: runtimeConfig.env.SNAPSHOT_EVERY_EVENTS
  });

  app.decorate(
    "authGuard",
    buildAuthMiddleware({
      tokenService,
      userRepository
    })
  );

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send(error.toResponse());
      return;
    }

    if ((error as any)?.name === "ZodError") {
      reply.code(400).send({ error: "VALIDATION_ERROR", details: (error as any).flatten?.() ?? undefined });
      return;
    }

    app.log.error(error);
    reply.code(500).send({ error: "INTERNAL_SERVER_ERROR" });
  });

  await app.register(healthRoutes);
  await app.register(
    buildAuthRoutes({
      userRepository,
      tokenService,
      passwordService: new PasswordService(),
      rateLimitService,
      useNewAuth: runtimeConfig.flags.useNewAuth,
      legacyProxy: legacyAuthProxy
    }),
    { prefix: "/v1" }
  );

  await app.register(
    buildRoomRoutes({
      roomBackboneService,
      rateLimitService,
      legacyProxy: legacyGameProxy,
      useDurableBackbone: runtimeConfig.flags.useDurableBackbone,
      enableFraudEnforcement: runtimeConfig.flags.enableFraudEnforcement
    }),
    { prefix: "/v1" }
  );

  const close = async () => {
    await withSpan("api-gateway", "shutdown", async () => {
      await eventBus.disconnectConsumers();
      await eventBus.disconnectProducer();
      await app.close();
      await disconnectPrisma().catch(() => undefined);
      await disconnectRedis().catch(() => undefined);
      await shutdownTracing();
    });

    process.exit(0);
  };

  process.on("SIGINT", () => void close());
  process.on("SIGTERM", () => void close());

  const port = Number(process.env.PORT || 3000);
  await app.listen({
    port,
    host: "0.0.0.0"
  });
}

void bootstrap();
