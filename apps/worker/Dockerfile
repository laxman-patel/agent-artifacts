FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/storage/package.json packages/storage/
COPY packages/renderer/package.json packages/renderer/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile

COPY packages/config/ packages/config/
COPY packages/db/ packages/db/
COPY packages/storage/ packages/storage/
COPY packages/renderer/ packages/renderer/
COPY apps/worker/ apps/worker/
RUN pnpm --filter @agent-artifacts/worker... build

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 workeruser

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/worker ./apps/worker

USER workeruser
ENV NODE_ENV=production
CMD ["node", "apps/worker/dist/index.js"]
