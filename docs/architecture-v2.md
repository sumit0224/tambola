# Tambola Architecture v2 (Incremental)

## Folder Structure (New)

```
packages/
  config/                 # Runtime config + feature flags
  db/                     # Prisma schema + repositories
  redis/                  # Room state + rate limit helpers
  events/                 # Kafka event bus + schemas
  security/               # JWT + password hashing helpers
  observability/          # OpenTelemetry + Prometheus metrics
services/
  api-gateway/            # REST gateway (auth + rooms) with flags
  realtime-gateway/       # Socket.io gateway + Redis adapter
  game-orchestrator/      # Stateless number caller + Kafka publish
```

## Key Data Flows

1. API Gateway handles auth/rooms, writes durable DB, Redis state, publishes Kafka events.
2. Game Orchestrator listens to `GAME_STARTED`, calls numbers, publishes `NUMBER_CALLED` events.
3. Realtime Gateway consumes Kafka events and broadcasts to Socket.io rooms.
4. Redis holds hot room state, Postgres stores durable sessions, events, claims, winners.
5. Snapshot + replay uses Postgres snapshots + event log, optionally mirrored in Redis for quick reads.

## Feature Flags

Flags are loaded from `packages/types/src/contracts/feature-flags.ts` and wired in `packages/config`.

- `FF_DURABLE_BACKBONE`
- `FF_REDIS_ROOM_STATE`
- `FF_KAFKA_EVENTS`
- `FF_NEW_AUTH`
- `FF_SOCKET_GATEWAY_V2`
- `FF_GAME_ORCHESTRATOR`
- `FF_FRAUD_ENFORCEMENT`
