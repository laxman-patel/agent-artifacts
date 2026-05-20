FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json tsconfig.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/
RUN bunx turbo run build --filter=@agent-artifacts/web...

FROM node:24-slim AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
