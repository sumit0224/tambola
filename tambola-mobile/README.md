# Tambola Mobile

React Native (Expo) mobile app for Tambola multiplayer.

## Prerequisites
- Node 18+
- npm 9+
- Expo Go app (for device testing)

## Setup
1. Copy envs if needed:
   - `cp .env.example .env`
2. Install dependencies:
   - `npm install`
3. Run the app:
   - `npx expo start`

## Backend URLs
Default URLs:
- Auth: `http://localhost:3001/v1`
- Game: `http://localhost:3003/v1`

For physical devices, replace `localhost` with your machine IP in `.env`.
