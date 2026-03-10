# Migration Plan (Incremental)

## Phase 0 — Baseline
- Keep existing `auth-service`, `game-service`, and `room-service` running.
- Set all `FF_*` flags to `false`.
- Deploy new services in parallel but do not route traffic.

## Phase 1 — Durable Auth
- Enable `FF_NEW_AUTH` in `api-gateway` only.
- Route `/v1/auth/*` traffic to `api-gateway`.
- Validate session creation/rotation in Postgres.
- Keep token compatibility for legacy services with bearer tokens.

## Phase 2 — Redis Room State
- Enable `FF_REDIS_ROOM_STATE` and `FF_DURABLE_BACKBONE` in `api-gateway` for `/rooms` create/join.
- Continue using legacy `game-service` for `/claim` and `/state`.
- Verify Redis TTL for inactive rooms and hot state read reliability.

## Phase 3 — Kafka Event Backbone
- Enable `FF_KAFKA_EVENTS` on `api-gateway`, `realtime-gateway`, `game-orchestrator`.
- Produce events on room creation/start and consume in `realtime-gateway`.
- Validate `NUMBER_CALLED` broadcast latency.

## Phase 4 — Game Orchestrator
- Enable `FF_GAME_ORCHESTRATOR` to start the orchestrator loop on `GAME_STARTED` events.
- Compare called numbers with legacy engine in shadow mode.

## Phase 5 — Realtime Gateway v2
- Enable `FF_SOCKET_GATEWAY_V2` for a percentage of traffic.
- Gradually route Web/Mobile clients to new socket endpoint.
- Validate reconnect + snapshot replay.

## Phase 6 — Claims + Fraud
- Implement claim validation in gateway + DB and turn off legacy claim path.
- Enable `FF_FRAUD_ENFORCEMENT` with soft actions first (manual review).

## Rollback Strategy
- Toggle `FF_*` flags back to `false`.
- Preserve event log and snapshots to avoid state loss.
- Keep legacy services live until parity is verified.
