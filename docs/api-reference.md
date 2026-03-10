# API Reference

## Auth Service (`services/auth-service`)
Base URL: `http://localhost:3001/v1`

- `POST /auth/register`
  - Body: `{ "email": "alice@example.com", "displayName": "Alice", "password": "password123" }`
  - Response: `{ "userId": "...", "token": "uid:<userId>", "refreshToken": "rid:..." }`
- `POST /auth/login`
  - Body: `{ "email": "alice@example.com", "password": "password123" }`
  - Response: `{ "token": "uid:<userId>", "refreshToken": "rid:...", "user": { ... } }`

## Game/Room Service (`services/game-service`)
Base URL: `http://localhost:3003/v1`

Auth headers for protected routes:
- `Authorization: Bearer uid:<userId>`
- or `x-user-id: <userId>`
- optional: `x-display-name: <name>`

- `POST /rooms`
  - Body: `{ "maxPlayers": 50, "callInterval": 5, "prizes": ["TOP_ROW", "FULL_HOUSE"] }`
  - Response: `{ "roomId": "...", "roomCode": "ABC123", "status": "LOBBY" }`
- `POST /rooms/join`
  - Body: `{ "roomCode": "ABC123" }`
- `POST /rooms/:roomId/start` (host only)
- `GET /rooms/:roomId/ticket` (for current user)
- `POST /rooms/:roomId/claim`
  - Body: `{ "claimType": "TOP_ROW" }`
- `GET /rooms/:roomId/state`
