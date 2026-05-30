# syntax=docker/dockerfile:1.7
#
# Build context: src/backend
# Two stages: SDK image for publish, dotnet/aspnet:alpine for the runtime.
# NOTE: although the migrator never hosts HTTP, it transitively requires the
# Microsoft.AspNetCore.App shared framework — the Application layer carries a
# FrameworkReference to it (IFormFile in the file-upload command), which flows
# into MigrationRunner. The plain dotnet/runtime base therefore fails at launch
# ("No frameworks were found"), so the runtime base must be dotnet/aspnet.

ARG DOTNET_SDK_TAG=10.0.100-alpine3.22
ARG DOTNET_RUNTIME_TAG=10.0-alpine

# -----------------------------------------------------------------------------
# build — SDK stage
# -----------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_SDK_TAG} AS build

ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1

WORKDIR /src

COPY StackSift.MigrationRunner/StackSift.MigrationRunner.csproj StackSift.MigrationRunner/
COPY StackSift.Infrastructure/StackSift.Infrastructure.csproj   StackSift.Infrastructure/
COPY StackSift.Application/StackSift.Application.csproj         StackSift.Application/
COPY StackSift.Domain/StackSift.Domain.csproj                   StackSift.Domain/

RUN dotnet restore StackSift.MigrationRunner/StackSift.MigrationRunner.csproj

COPY StackSift.MigrationRunner/ StackSift.MigrationRunner/
COPY StackSift.Infrastructure/  StackSift.Infrastructure/
COPY StackSift.Application/     StackSift.Application/
COPY StackSift.Domain/          StackSift.Domain/

RUN dotnet publish StackSift.MigrationRunner/StackSift.MigrationRunner.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
    /p:UseAppHost=false

# -----------------------------------------------------------------------------
# runtime — dotnet/aspnet:alpine (ASP.NET shared framework required, see top note)
# -----------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_RUNTIME_TAG} AS runtime

ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.title="stacksift-migrator" \
      org.opencontainers.image.description="StackSift EF Core migration runner" \
      org.opencontainers.image.source="https://github.com/drdtrn/StackSift" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}"

ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1

# netcat-openbsd: optional Postgres wait. icu-libs: Npgsql globalisation.
# tzdata: deterministic timestamps in logs.
RUN apk add --no-cache netcat-openbsd icu-libs tzdata \
 && addgroup -S appuser \
 && adduser -S -G appuser -u 10001 appuser \
 && mkdir -p /app \
 && chown -R appuser:appuser /app

WORKDIR /app

COPY --from=build --chown=appuser:appuser /app/publish .
COPY --from=build --chown=appuser:appuser /src/StackSift.MigrationRunner/docker-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER appuser

ENTRYPOINT ["/app/entrypoint.sh"]
