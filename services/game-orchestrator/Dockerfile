FROM node:20-alpine AS base
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY services/game-orchestrator ./services/game-orchestrator

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @tambola/game-orchestrator build

CMD ["pnpm", "--filter", "@tambola/game-orchestrator", "start"]
