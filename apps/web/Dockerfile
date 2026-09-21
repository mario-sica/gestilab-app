# syntax=docker/dockerfile:1
# Contesto di build: la radice del monorepo (necessario per pnpm workspaces).

FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json
COPY vendor/gestilab-auth-service/package.json vendor/gestilab-auth-service/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @gestilab/web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# next.config.ts ha "output: standalone": la cartella .next/standalone
# contiene già un node_modules minimo con le sole dipendenze di produzione.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
