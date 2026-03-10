# Tambola Platform Monorepo

Production-oriented skeleton based on the `Tambola_System_Design_LLD.docx` architecture.

## Workspace Layout
- `apps/web`: Next.js web client
- `apps/mobile`: React Native / Expo client
- `services/auth-service`: JWT/OAuth-facing auth API
- `services/room-service`: room lifecycle and join/start orchestration
- `services/game-service`: game engine, claims, and Socket.io gateway
- `packages/db`: Prisma schema and DB client
- `packages/redis`: Redis client and key helpers
- `packages/types`: shared API/domain/socket types
- `packages/config`: shared environment schema
- `infra`: Kubernetes and Terraform skeletons

## Quick Start
1. Install dependencies: `pnpm install`
2. Start all dev targets: `pnpm dev`
3. Build everything: `pnpm build`

## Notes
- This is a scaffold: endpoints and services are wired with minimal implementations.
- The folder structure mirrors section 16 of the system design document.
