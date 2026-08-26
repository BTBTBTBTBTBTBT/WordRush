# Railway build for the VS realtime server (apps/server → server.wordocious.com).
#
# Exists because Railpack v0.38.0 (2026-08-26) stopped installing pnpm via
# Corepack and its Mise resolver cannot resolve pnpm 8.15.0 — every Railpack
# build now dies at prepare with "Failed to resolve version 8.15.0 of pnpm"
# (§240). Railway auto-detects this Dockerfile and uses it instead; Vercel
# ignores it, so the web build path is untouched. The pnpm version below must
# match "packageManager" in package.json.
#
# The start command lives in railway.json (config-as-code overrides the
# dashboard's old "cd apps/server && …" custom start command, which Railway
# execs WITHOUT a shell on Dockerfile deploys — `cd` is not an executable).
# It is shell-free and cwd-independent: the server resolves every data file
# via __dirname. CMD mirrors it so the image also runs alone.
FROM node:22-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile
EXPOSE 3001
CMD ["pnpm", "-C", "apps/server", "exec", "tsx", "src/index.ts"]
