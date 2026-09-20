# syntax=docker/dockerfile:1
# Contesto di build: la radice del monorepo (necessario per pnpm workspaces).

FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @gestilab/api build

# ---
# packages/shared non ha ancora un proprio step di build (resta sorgente TS,
# vedi task 0.1): l'unica via pulita per eseguire apps/api in produzione senza
# portarsi dietro l'intero toolchain di sviluppo è eseguire il sorgente già
# validato dallo stage "build" tramite tsx, ora dipendenza di produzione di
# apps/api. Quando packages/shared avrà un proprio build, questo stage potrà
# passare a servire solo JS compilato.
FROM node:22-alpine AS runner
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --prod --frozen-lockfile --filter @gestilab/api...
COPY --from=build /app/packages/shared/src ./packages/shared/src
COPY --from=build /app/apps/api/src ./apps/api/src
USER node
EXPOSE 3001
CMD ["pnpm", "--filter", "@gestilab/api", "exec", "tsx", "src/server.ts"]
