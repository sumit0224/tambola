import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { getRuntimeConfig } from "@tambola/config";
import { GameRepository, RoomRepository, UserRepository, disconnectPrisma } from "@tambola/db";
import { KafkaEventBus, NoopEventBus } from "@tambola/events";
import { registerMetricsEndpoint, initTracing, shutdownTracing } from "@tambola/observability";
import { redisPublisher, redisSubscriber, RoomStateStore, disconnectRedis } from "@tambola/redis";
import { TokenService } from "@tambola/security";
import { buildSocketAuth } from "./socket/socketAuth";
import { RealtimeGateway } from "./services/RealtimeGateway";

async function bootstrap() {
  const runtimeConfig = getRuntimeConfig(process.env);
  await initTracing("realtime-gateway");

  const fastify = Fastify({ logger: true, trustProxy: true });
  const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000,https://tambola.vercel.app")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  await fastify.register(cors, { origin: corsOrigins, credentials: true });
  await fastify.register(helmet);
  await fastify.register(rateLimit, { max: 200, timeWindow: "1 minute" });
  registerMetricsEndpoint(fastify, "realtime_gateway");

  fastify.get("/health", async () => ({ status: "ok", service: "realtime-gateway" }));
  fastify.get("/ready", async () => ({ ready: true, service: "realtime-gateway" }));
  fastify.get("/healthz", async () => ({ ok: true, service: "realtime-gateway" }));
  fastify.get("/readyz", async () => ({ ready: true, service: "realtime-gateway" }));

  const io = new Server(fastify.server, {
    cors: { origin: corsOrigins, credentials: true }
  });

  const pubClient = redisPublisher.duplicate();
  const subClient = redisSubscriber.duplicate();

  io.adapter(createAdapter(pubClient, subClient));

  const tokenService = new TokenService({
    issuer: runtimeConfig.env.JWT_ISSUER,
    audience: runtimeConfig.env.JWT_AUDIENCE,
    accessSecret: runtimeConfig.env.JWT_ACCESS_SECRET,
    refreshSecret: runtimeConfig.env.JWT_REFRESH_SECRET,
    accessTtlSeconds: runtimeConfig.env.ACCESS_TOKEN_TTL_SECONDS,
    refreshTtlSeconds: runtimeConfig.env.REFRESH_TOKEN_TTL_SECONDS
  });

  const userRepository = new UserRepository();
  io.use(buildSocketAuth({ tokenService, userRepository }));

  const eventBus = runtimeConfig.flags.useKafkaEvents
    ? new KafkaEventBus({
        clientId: `${runtimeConfig.env.KAFKA_CLIENT_ID}-realtime-gateway`,
        brokers: runtimeConfig.kafkaBrokers
      })
    : new NoopEventBus();

  const realtimeGateway = new RealtimeGateway({
    io,
    roomRepository: new RoomRepository(),
    gameRepository: new GameRepository(),
    userRepository,
    roomStateStore: new RoomStateStore(),
    eventBus,
    consumerGroupId: `${runtimeConfig.env.KAFKA_CLIENT_ID}-realtime-gateway-${process.pid}`,
    useKafkaEvents: runtimeConfig.flags.useKafkaEvents
  });

  realtimeGateway.initialize();
  await realtimeGateway.startEventFanout();

  const port = Number(process.env.PORT || 3000);
  await fastify.listen({
    port,
    host: "0.0.0.0"
  });

  const close = async () => {
    await eventBus.disconnectConsumers();
    await eventBus.disconnectProducer();
    io.close();
    await fastify.close();
    await Promise.all([pubClient.quit().catch(() => undefined), subClient.quit().catch(() => undefined)]);
    await disconnectPrisma().catch(() => undefined);
    await disconnectRedis().catch(() => undefined);
    await shutdownTracing();
    process.exit(0);
  };

  process.on("SIGINT", () => void close());
  process.on("SIGTERM", () => void close());
}

void bootstrap();
