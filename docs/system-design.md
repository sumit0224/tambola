# Tambola System Design

This repository skeleton is derived from `Tambola_System_Design_LLD.docx`.

## Key Decisions
- Multi-service Node.js backend with separate auth, room, and game services.
- Redis for real-time state and Pub/Sub fan-out.
- PostgreSQL for durable audit/history data.
- Next.js and React Native clients using a shared WebSocket event contract.
