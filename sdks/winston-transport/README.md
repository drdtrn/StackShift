# @stacksift/winston-transport

[![Pre-1.0](https://img.shields.io/badge/stability-pre--1.0-orange)](https://github.com/drdtrn/StackSift/blob/main/docs/integrate/sdk-versioning.md)

Winston transport that ships log events from your Node.js app to [StackSift](https://github.com/drdtrn/StackSift). Buffers, batches, retries on 429/5xx, drops on 4xx-other; never blocks the application event loop.

Targets Node ≥ 20.

## Install

```sh
pnpm add winston @stacksift/winston-transport
# or
npm install winston @stacksift/winston-transport
```

## Quick start

```ts
import winston from 'winston';
import { StackSiftTransport } from '@stacksift/winston-transport';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new StackSiftTransport({
      ingestUrl: 'https://api.stacksift.com/api/v1/logs/ingest',
      apiKey: process.env.STACKSIFT_API_KEY!,
      projectId: '11111111-1111-1111-1111-111111111111',
      logSourceId: '22222222-2222-2222-2222-222222222222',
      serviceName: 'checkout-svc',
    }),
  ],
});

logger.info('Service started');

// Before process exit (graceful-shutdown handler, etc.):
// await (logger.transports[1] as StackSiftTransport).close();
```

Replace the `ingestUrl`, `projectId`, and `logSourceId` with the values from your log-source integration page in the StackSift dashboard. Get the API key from the one-time reveal modal when you create or regenerate the log source.

Always read the key from an environment variable (or your secret manager). Never commit it.

## Configuration

| Option                     | Default        | Notes                                                                  |
|----------------------------|----------------|------------------------------------------------------------------------|
| `ingestUrl`                | *(required)*   | Full URL incl. `/api/v1/logs/ingest`.                                  |
| `apiKey`                   | *(required)*   | `ss_…` from the dashboard. Never commit.                               |
| `projectId`                | *(required)*   | UUID from the dashboard.                                               |
| `logSourceId`              | *(required)*   | UUID from the dashboard.                                               |
| `serviceName`              | `undefined`    | Identifies your service in the dashboard.                              |
| `hostName`                 | `undefined`    | Override (defaults to nothing if absent on the log event).             |
| `bufferSize`               | `100`          | Events per batch (max 1000, the ingest API's hard cap).                |
| `flushInterval`            | `2000` (ms)    | Flush even if `bufferSize` isn't reached.                              |
| `requestTimeout`           | `10000` (ms)   | Per-request HTTP timeout.                                              |
| `maxRetries`               | `5`            | Per-batch retries on 429/5xx/network errors.                           |
| `initialRetryDelay`        | `1000` (ms)    | Doubles each retry, capped at `maxRetryDelay`.                         |
| `maxRetryDelay`            | `30000` (ms)   |                                                                        |
| `queueCapacityMultiplier`  | `10`           | Bounded queue size = `bufferSize * multiplier`. Overflow drops new events. |
| `level` / `silent`         | Winston defaults | Standard `winston-transport` options.                                |

## How the transport behaves

- **Non-blocking.** `log(info, callback)` pushes onto an in-memory queue and returns immediately. If the queue is full, the new event is dropped and `transport.getDroppedCount()` is incremented. Your event loop is never blocked on the network.
- **Batched.** Up to `bufferSize` events per HTTP POST, or every `flushInterval` ms, whichever comes first.
- **Retried.** 5xx and network errors retry with exponential backoff (1s → 2s → 4s → … capped at `maxRetryDelay`), giving up after `maxRetries`. 429 honours `Retry-After`. 4xx-other (400/401/403/404) drops the batch and emits a `warn` event — these are configuration errors that retrying won't fix.
- **Graceful.** `await transport.close()` flushes the queue and stops the periodic timer. Wire it into your process's shutdown handler.

If you don't call `close()`, the periodic timer keeps the event loop alive. The transport calls `flushTimer.unref()` so it doesn't itself prevent `process.exit`, but in-flight log events queued after the last timer fire are lost on exit.

## Error events

The transport emits a `warn` event on Winston when a batch is dropped:

```ts
const transport = new StackSiftTransport({ /* ... */ });
transport.on('warn', (err) => {
  console.error('[stacksift] %s', err.message);
});
```

## Pre-1.0 stability

The package is on a `0.x` line until the wire shape has settled and at least one external service has run it in production unchanged for 30 days. Until then, minor-version bumps may include breaking changes. See [sdk-versioning.md](https://github.com/drdtrn/StackSift/blob/main/docs/integrate/sdk-versioning.md) for the policy.

## Links

- [Ingestion API reference](https://github.com/drdtrn/StackSift/blob/main/docs/integrate/api-reference.md)
- [SDK versioning policy](https://github.com/drdtrn/StackSift/blob/main/docs/integrate/sdk-versioning.md)
- [Issues](https://github.com/drdtrn/StackSift/issues)
