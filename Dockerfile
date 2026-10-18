# syntax=docker/dockerfile:1.7
FROM node:26.12.0-bookworm-slim AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS builder
COPY . .
# Client generation needs a syntactically valid URL; builds never receive credentials.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=life_planning
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN mkdir -p public && npm run build

FROM dependencies AS migrator
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY scripts/bootstrap.ts ./scripts/bootstrap.ts
COPY src/lib ./src/lib
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=life_planning npm run db:generate \
    && apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
        /usr/local/bin/yarn /usr/local/bin/yarnpkg /usr/local/bin/pnpm /usr/local/bin/pnpx
USER node
CMD ["node", "--env-file=/run/secrets/app.env", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM node:26.12.0-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# Apply available Debian security fixes and remove package-manager tooling that
# is not needed by the production runtime. The app starts with node directly.
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
        /usr/local/bin/yarn /usr/local/bin/yarnpkg /usr/local/bin/pnpm /usr/local/bin/pnpx \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=1001:1001 /app/.next/standalone ./
COPY --from=builder --chown=1001:1001 /app/.next/static ./.next/static
COPY --from=builder --chown=1001:1001 /app/public ./public
USER 1001:1001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--env-file=/run/secrets/app.env", "server.js"]
