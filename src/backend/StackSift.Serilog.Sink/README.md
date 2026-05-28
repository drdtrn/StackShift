# StackSift.Serilog.Sink

[![Pre-1.0](https://img.shields.io/badge/stability-pre--1.0-orange)](https://github.com/drdtrn/StackSift/blob/main/docs/integrate/sdk-versioning.md)

Serilog sink that ships log events from your .NET app to [StackSift](https://github.com/drdtrn/StackSift). Buffers, batches, retries on 429/5xx, drops on 4xx-other; never blocks the application thread.

Targets `net8.0`, `net9.0`, `net10.0`.

## Install

```sh
dotnet add package StackSift.Serilog.Sink
```

## Quick start

```csharp
using Serilog;
using StackSift.Serilog.Sink;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.StackSift(new StackSiftSinkOptions
    {
        IngestUrl   = "https://api.stacksift.com/api/v1/logs/ingest",
        ApiKey      = Environment.GetEnvironmentVariable("STACKSIFT_API_KEY")!,
        ProjectId   = new Guid("11111111-1111-1111-1111-111111111111"),
        LogSourceId = new Guid("22222222-2222-2222-2222-222222222222"),
        ServiceName = "checkout-svc",
    })
    .CreateLogger();

Log.Information("Service started");
// ...

await Log.CloseAndFlushAsync();
```

Replace the `IngestUrl`, `ProjectId`, and `LogSourceId` with the values shown on your log-source integration page in the StackSift dashboard. Get the API key from the one-time reveal modal when you create or regenerate the log source.

Always read the key from an environment variable (or your secret manager). Never commit it.

## Configuration

| Option                     | Default        | Notes                                                              |
|----------------------------|----------------|--------------------------------------------------------------------|
| `IngestUrl`                | *(required)*   | Full URL incl. `/api/v1/logs/ingest`.                              |
| `ApiKey`                   | *(required)*   | `ss_…` from the dashboard. Never commit.                           |
| `ProjectId`                | *(required)*   | UUID from the dashboard.                                           |
| `LogSourceId`              | *(required)*   | UUID from the dashboard.                                           |
| `ServiceName`              | `null`         | Identifies your service in the dashboard.                          |
| `HostName`                 | `null`         | Override (defaults to nothing if absent on the log event).         |
| `BufferSize`               | `100`          | Events per batch (max 1000, the ingest API's hard cap).            |
| `FlushInterval`            | `2s`           | Flush even if `BufferSize` isn't reached.                          |
| `RequestTimeout`           | `10s`          | Per-request HTTP timeout.                                          |
| `MaxRetries`               | `5`            | Per-batch retries on 429/5xx/network errors.                       |
| `InitialRetryDelay`        | `1s`           | Doubles each retry, capped at `MaxRetryDelay`.                     |
| `MaxRetryDelay`            | `30s`          |                                                                    |
| `QueueCapacityMultiplier`  | `10`           | Bounded queue size = `BufferSize * multiplier`. Overflow drops oldest. |
| `ShutdownDrainTimeout`     | `5s`           | Time `Dispose()` waits for in-flight batches.                      |

## How the sink behaves

- **Non-blocking.** `Emit()` enqueues into a bounded channel. If the queue is full, the *oldest* event is dropped and `StackSiftSink.EventsDropped` is incremented. Your application thread is never blocked on the network.
- **Batched.** Up to `BufferSize` events per HTTP POST, or every `FlushInterval`, whichever comes first.
- **Retried.** 5xx and network errors retry with exponential backoff (1s → 2s → 4s → … capped at `MaxRetryDelay`), giving up after `MaxRetries`. 429 responses honour `Retry-After`. 4xx-other (400/401/403/404) drop the batch and write to Serilog's `SelfLog` — these are configuration errors that retrying won't fix.
- **Graceful.** `Dispose()` (called by `Log.CloseAndFlush()`) waits up to `ShutdownDrainTimeout` for in-flight batches to drain.

Always call `Log.CloseAndFlush()` (or `await Log.CloseAndFlushAsync()`) before your process exits, otherwise the in-memory queue is lost.

## Self-log

If you suspect the sink is silently failing, enable Serilog's self-log:

```csharp
Serilog.Debugging.SelfLog.Enable(Console.Error);
```

The sink writes diagnostic lines like *"StackSiftSink: gave up after 5 5xx responses; dropped 100 events."*

## Pre-1.0 stability

The package is on a `0.x` line until the wire shape has settled and at least one external service has run it in production unchanged for 30 days. Until then, minor-version bumps may include breaking changes. See [sdk-versioning.md](https://github.com/drdtrn/StackSift/blob/main/docs/integrate/sdk-versioning.md) for the policy.

## Links

- [Ingestion API reference](https://github.com/drdtrn/StackSift/blob/main/docs/integrate/api-reference.md)
- [SDK versioning policy](https://github.com/drdtrn/StackSift/blob/main/docs/integrate/sdk-versioning.md)
- [Issues](https://github.com/drdtrn/StackSift/issues)
