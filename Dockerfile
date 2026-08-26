# Railway build for the VS realtime server (apps/server → server.wordocious.com).
#
# Exists because Railpack v0.38.0 (2026-08-26) stopped installing pnpm via
# Corepack and its Mise resolver cannot resolve pnpm 8.15.0 — every Railpack
# build now dies at prepare with "Failed to resolve version 8.15.0 of pnpm"
# (§240). Railway auto-detects this Dockerfile and uses it instead; Vercel
# ignores it, so the web build path is untouched. The pnpm version below must
# match "packageManager" in package.json.
#
# Railway's service-level custom start command (cd apps/server && npx tsx
# src/index.ts) overrides CMD; CMD mirrors it so the image also runs alone.
FROM node:22-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile
EXPOSE 3001
CMD ["sh", "-c", "cd apps/server && npx tsx src/index.ts"]
