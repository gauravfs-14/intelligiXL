# syntax=docker/dockerfile:1
#
# IntelligiXL production image. One image, two roles (see docker/entrypoint.sh):
#   docker run <image> web      -> prisma migrate deploy, seed, next start
#   docker run <image> worker   -> BullMQ Smart Column worker (tsx scripts/worker.ts)
#
# Debian slim (glibc) rather than alpine: the Prisma CLI's schema engine
# (used by `migrate deploy`) ships glibc/openssl-3 builds, and the driver
# adapter (@prisma/adapter-pg) path needs no native query engine at all.

ARG NODE_VERSION=22

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# postinstall runs `prisma generate`, which needs the schema + prisma config.
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
# Store lives in a BuildKit cache mount, so it never ends up in an image layer.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    corepack install \
 && pnpm config set store-dir /pnpm/store \
 && pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
FROM deps AS build
COPY . .
# prisma.config.ts resolves env("DATABASE_URL") eagerly; generate/build never connect.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm exec prisma generate \
 && pnpm exec next build \
 && rm -rf .next/cache

# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    LOCAL_STORAGE_DIR=/app/.data/storage

# Everything the web server and the tsx-run worker need (dev deps included:
# the worker runs TypeScript source through tsx).
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/tsconfig.json /app/next.config.ts /app/prisma.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src
COPY --from=build /app/public ./public
COPY --from=build --chown=node:node /app/.next ./.next
COPY --chmod=0755 docker/entrypoint.sh /usr/local/bin/entrypoint

# .data is the shared volume (uploads, exports, auto-generated app-secret).
# Creating it here as `node` makes a fresh named volume inherit that ownership.
RUN mkdir -p /app/.data/storage && chown -R node:node /app/.data
VOLUME ["/app/.data"]

USER node
EXPOSE 3000
ENTRYPOINT ["entrypoint"]
CMD ["web"]
