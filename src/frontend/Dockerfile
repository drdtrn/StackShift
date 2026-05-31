# syntax=docker/dockerfile:1.7
#
# Build context: the repository root (so pnpm-workspace.yaml + pnpm-lock.yaml
# are visible during `pnpm install`).

ARG NODE_TAG=20-alpine

# -----------------------------------------------------------------------------
# deps — install pnpm + project deps once, cache aggressively
# -----------------------------------------------------------------------------
FROM node:${NODE_TAG} AS deps

RUN apk add --no-cache libc6-compat \
 && npm install -g pnpm@10.33.0

WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY src/frontend/package.json   src/frontend/package.json
COPY src/marketing/package.json  src/marketing/package.json
COPY src/shared                  src/shared
COPY sdks/winston-transport/package.json sdks/winston-transport/package.json

RUN pnpm install --frozen-lockfile --filter ./src/frontend...

# -----------------------------------------------------------------------------
# build — produce .next/standalone for the runtime stage
# -----------------------------------------------------------------------------
FROM node:${NODE_TAG} AS build

RUN npm install -g pnpm@10.33.0

WORKDIR /repo

COPY --from=deps /repo/node_modules            ./node_modules
COPY --from=deps /repo/src/frontend/node_modules src/frontend/node_modules

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY src/frontend  src/frontend
COPY src/marketing/package.json src/marketing/package.json
COPY src/shared    src/shared
COPY sdks/winston-transport/package.json sdks/winston-transport/package.json

ARG NEXT_PUBLIC_API_URL=http://localhost:5190
ARG NEXT_PUBLIC_AUTH_MOCK=false
ARG NEXT_PUBLIC_SIGNALR_MOCK=false
# SignalR hub URL is read client-side (browser opens the WebSocket) → must be
# baked at build, not injected at runtime. Defaults to the API origin + /hubs.
ARG NEXT_PUBLIC_SIGNALR_HUB_URL=http://localhost:5190/hubs/stacksift
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_AUTH_MOCK=${NEXT_PUBLIC_AUTH_MOCK} \
    NEXT_PUBLIC_SIGNALR_MOCK=${NEXT_PUBLIC_SIGNALR_MOCK} \
    NEXT_PUBLIC_SIGNALR_HUB_URL=${NEXT_PUBLIC_SIGNALR_HUB_URL} \
    NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter ./src/frontend build

# -----------------------------------------------------------------------------
# runtime — minimal node:alpine with the standalone output
# -----------------------------------------------------------------------------
FROM node:${NODE_TAG} AS runtime

ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.title="stacksift-frontend" \
      org.opencontainers.image.description="StackSift dashboard (Next.js)" \
      org.opencontainers.image.source="https://github.com/drdtrn/StackSift" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}"

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# The standalone output ships its own minimal node_modules.
COPY --from=build --chown=node:node /repo/src/frontend/.next/standalone ./
COPY --from=build --chown=node:node /repo/src/frontend/.next/static ./src/frontend/.next/static
COPY --from=build --chown=node:node /repo/src/frontend/public ./src/frontend/public

USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "src/frontend/server.js"]
