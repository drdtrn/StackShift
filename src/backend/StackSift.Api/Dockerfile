# syntax=docker/dockerfile:1.7
#
# Build context: src/backend  (run `docker build` with that as the context).
# Two stages: SDK image for restore/build/publish/migrations-bundle,
# aspnet:alpine for the runtime.

# Pin to a 10.0.1xx-band SDK to match the local toolchain (global.json
# requests 10.0.102 with rollForward=latestPatch). The unpinned 10.0-alpine
# tag currently resolves to 10.0.300, which has a globbing regression that
# breaks Release publishes with implicit-include EmbeddedResource items.
ARG DOTNET_SDK_TAG=10.0.100-alpine3.22
ARG DOTNET_RUNTIME_TAG=10.0-alpine

# -----------------------------------------------------------------------------
# build — SDK stage
# -----------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_SDK_TAG} AS build

ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1 \
    PATH="$PATH:/root/.dotnet/tools"

WORKDIR /src

# Restore is partitioned so changing source code without changing csproj files
# reuses the cached restore layer.
COPY StackSift.Api/StackSift.Api.csproj                       StackSift.Api/
COPY StackSift.Application/StackSift.Application.csproj       StackSift.Application/
COPY StackSift.Infrastructure/StackSift.Infrastructure.csproj StackSift.Infrastructure/
COPY StackSift.Domain/StackSift.Domain.csproj                 StackSift.Domain/

RUN dotnet restore StackSift.Api/StackSift.Api.csproj \
 && dotnet tool install --global dotnet-ef --version 10.*

# Copy the rest and publish.
COPY StackSift.Api/         StackSift.Api/
COPY StackSift.Application/ StackSift.Application/
COPY StackSift.Infrastructure/ StackSift.Infrastructure/
COPY StackSift.Domain/      StackSift.Domain/

RUN dotnet publish StackSift.Api/StackSift.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
    /p:UseAppHost=false

# Self-contained EF migrations bundle. ~80 MB; runs without the SDK at runtime.
# linux-musl-x64 targets the alpine runtime image's libc.
RUN dotnet ef migrations bundle \
        --project StackSift.Infrastructure/StackSift.Infrastructure.csproj \
        --startup-project StackSift.Api/StackSift.Api.csproj \
        --self-contained -r linux-musl-x64 \
        --force \
        -o /app/publish/migrate

# -----------------------------------------------------------------------------
# runtime — aspnet:alpine
# -----------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_RUNTIME_TAG} AS runtime

ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.title="stacksift-api" \
      org.opencontainers.image.description="StackSift .NET 10 API" \
      org.opencontainers.image.source="https://github.com/drdtrn/StackSift" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}"

ENV ASPNETCORE_URLS=http://+:5190 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1

# netcat-openbsd: entrypoint waits on Postgres readiness.
# icu-libs:       Npgsql needs globalisation for case-insensitive collation.
# tzdata:         deterministic timestamps in logs.
RUN apk add --no-cache netcat-openbsd icu-libs tzdata \
 && addgroup -S appuser \
 && adduser -S -G appuser -u 10001 appuser \
 && mkdir -p /app \
 && chown -R appuser:appuser /app

WORKDIR /app

COPY --from=build --chown=appuser:appuser /app/publish .
COPY --from=build --chown=appuser:appuser /src/StackSift.Api/docker-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh /app/migrate

USER appuser

EXPOSE 5190

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:5190/api/v1/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
