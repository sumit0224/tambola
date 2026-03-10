import Fastify from "fastify";
import cors from "@fastify/cors";
import { getRuntimeConfig } from "@tambola/config";
import { GameRepository, RoomRepository } from "@tambola/db";
import { KafkaEventBus, NoopEventBus } from "@tambola/events";
import { registerMetricsEndpoint, initTracing, shutdownTracing } from "@tambola/observability";
import { RoomStateStore } from "@tambola/redis";
import { buildControlRoutes } from "./routes/control.routes";
import { healthRoutes } from "./routes/health.routes";
import { GameLoopWorker } from "./services/GameLoopWorker";

async function bootstrap() {
  const runtimeConfig = getRuntimeConfig(process.env);
  await initTracing("game-orchestrator");

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  registerMetricsEndpoint(app, "game_orchestrator");

  const eventBus = runtimeConfig.flags.useKafkaEvents
    ? new KafkaEventBus({
        clientId: `${runtimeConfig.env.KAFKA_CLIENT_ID}-game-orchestrator`,
        brokers: runtimeConfig.kafkaBrokers
      })
    : new NoopEventBus();

  if (runtimeConfig.flags.useKafkaEvents) {
    await eventBus.ensureTopics();
  }
  await eventBus.connectProducer();

  const worker = new GameLoopWorker({
    eventBus,
    gameRepository: new GameRepository(),
    roomRepository: new RoomRepository(),
    roomStateStore: new RoomStateStore(),
    snapshotEveryEvents: runtimeConfig.env.SNAPSHOT_EVERY_EVENTS,
    groupId: `${runtimeConfig.env.KAFKA_CLIENT_ID}-game-orchestrator-${process.pid}`,
    useKafkaEvents: runtimeConfig.flags.useKafkaEvents
  });

  if (runtimeConfig.flags.useGameOrchestrator) {
    await worker.initialize();
  }

  await app.register(healthRoutes);
  await app.register(buildControlRoutes(worker), { prefix: "/v1" });

  const close = async () => {
    await eventBus.disconnectConsumers();
    await eventBus.disconnectProducer();
    await app.close();
    await shutdownTracing();
    process.exit(0);
  };

  process.on("SIGINT", () => void close());
  process.on("SIGTERM", () => void close());

  await app.listen({
    port: runtimeConfig.env.ORCHESTRATOR_PORT,
    host: "0.0.0.0"
  });
}

void bootstrap();
