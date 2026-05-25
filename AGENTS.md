# Agent Artifacts

## Cursor Cloud specific instructions

### Overview

This is a Bun + Turborepo monorepo for a versioned artifact hosting platform. See `README.md` for development commands (`bun install`, `bun run dev`, `bun run typecheck`, `bun run test`, `bun run lint`).

### External services required for local dev

| Service | How to run locally |
|---|---|
| PostgreSQL | `sudo pg_ctlcluster 16 main start` (or system service). DB: `agent_artifacts`, user: `agentartifacts` / `devpassword` |
| MinIO (S3-compatible) | `MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin minio server /tmp/minio-data --console-address :9001`. Create bucket: `mc alias set local http://127.0.0.1:9000 minioadmin minioadmin && mc mb local/agent-artifacts --ignore-existing` |

### Environment setup

- Copy `.env.example` to `.env` and adjust values. For local dev with PostgreSQL + MinIO, set `DATABASE_URL` to `postgresql://agentartifacts:devpassword@127.0.0.1:5432/agent_artifacts` and `S3_ENDPOINT` to `http://127.0.0.1:9000`.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` can be set to placeholder values if you don't need real OAuth; the app starts fine but Google sign-in won't work.
- `BETTER_AUTH_SECRET` must be at least 32 characters.

### Gotchas

- Node.js >= 24 is **required** (the `engines` field in `package.json` enforces this). Use `nvm install 24 && nvm use 24`.
- The `bun run dev` command loads `.env` automatically via `--env-file=.env` in the script. Individual `bun run db:migrate` also loads it the same way.
- Lint in this repo is purely TypeScript type-checking (`tsc`), not ESLint.
- The web app (Next.js, port 3000) proxies `/api/*` to the API server (Hono, port 3001) via Next.js rewrites. Both must be running.
- To test authenticated API calls without real Google OAuth, insert a user + session directly into PostgreSQL and use the session token as a Bearer token.
- The `.deepsec/` directory is a separate pnpm workspace for security scanning; it is independent from the main app and not required for development.
