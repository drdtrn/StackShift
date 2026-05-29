# syntax=docker/dockerfile:1.7
#
# Build context: the repository root.

ARG NODE_TAG=20-alpine

# -----------------------------------------------------------------------------
# deps
# -----------------------------------------------------------------------------
FROM node:${NODE_TAG} AS deps

RUN apk add --no-cache libc6-compat \
 && npm install -g pnpm@10.33.0

WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY src/marketing/package.json  src/marketing/package.json
COPY src/frontend/package.json   src/frontend/package.json
COPY src/shared                  src/shared
COPY sdks/winston-transport/package.json sdks/winston-transport/package.json

RUN pnpm install --frozen-lockfile --filter ./src/marketing...

# -----------------------------------------------------------------------------
# build
# -----------------------------------------------------------------------------
FROM node:${NODE_TAG} AS build

RUN npm install -g pnpm@10.33.0

WORKDIR /repo

COPY --from=deps /repo/node_modules            ./node_modules
COPY --from=deps /repo/src/marketing/node_modules src/marketing/node_modules

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY src/marketing src/marketing
COPY src/frontend/package.json src/frontend/package.json
COPY src/shared    src/shared
COPY sdks/winston-transport/package.json sdks/winston-transport/package.json

ARG NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_BASE_URL=${NEXT_PUBLIC_APP_BASE_URL} \
    NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter ./src/marketing build

# -----------------------------------------------------------------------------
# runtime
# -----------------------------------------------------------------------------
FROM node:${NODE_TAG} AS runtime

ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.title="stacksift-marketing" \
      org.opencontainers.image.description="StackSift marketing site (Next.js)" \
      org.opencontainers.image.source="https://github.com/drdtrn/StackSift" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}"

ENV NODE_ENV=production \
    PORT=3200 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY --from=build --chown=node:node /repo/src/marketing/.next/standalone ./
COPY --from=build --chown=node:node /repo/src/marketing/.next/static ./src/marketing/.next/static
COPY --from=build --chown=node:node /repo/src/marketing/public ./src/marketing/public

USER node

EXPOSE 3200

HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=5 \
  CMD wget -qO- http://localhost:3200/api/health || exit 1

CMD ["node", "src/marketing/server.js"]
