FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json tsconfig.json ./
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/auth/package.json packages/auth/
COPY packages/policy/package.json packages/policy/
COPY packages/storage/package.json packages/storage/
COPY packages/artifact/package.json packages/artifact/
COPY packages/mcp/package.json packages/mcp/
COPY packages/access/package.json packages/access/
COPY apps/api/package.json apps/api/
RUN bun install --frozen-lockfile

COPY packages/config/ packages/config/
COPY packages/db/ packages/db/
COPY packages/shared/ packages/shared/
COPY packages/auth/ packages/auth/
COPY packages/policy/ packages/policy/
COPY packages/storage/ packages/storage/
COPY packages/artifact/ packages/artifact/
COPY packages/mcp/ packages/mcp/
COPY packages/access/ packages/access/
COPY apps/api/ apps/api/
RUN bunx turbo run build --filter=@agent-artifacts/api...

FROM node:24-slim AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 apiuser

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api

USER apiuser
EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "apps/api/dist/server.js"]
