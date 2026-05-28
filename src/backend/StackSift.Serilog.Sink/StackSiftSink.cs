using System.Net;
using System.Net.Http.Headers;
using System.Threading.Channels;
using Serilog.Core;
using Serilog.Debugging;
using Serilog.Events;
using StackSift.Serilog.Sink.Internal;

namespace StackSift.Serilog.Sink;

public sealed class StackSiftSink : ILogEventSink, IDisposable
{
    private static long _droppedCount;
    public static long EventsDropped => Interlocked.Read(ref _droppedCount);

    private readonly StackSiftSinkOptions _options;
    private readonly Channel<LogEvent> _channel;
    private readonly HttpClient _http;
    private readonly bool _ownsHttpClient;
    private readonly CancellationTokenSource _cts = new();
    private readonly Task _worker;
    private readonly int _queueCapacity;
    private int _disposed;

    public StackSiftSink(StackSiftSinkOptions options, HttpClient? http = null)
    {
        ArgumentNullException.ThrowIfNull(options);
        options.Validate();

        _options = options;
        _queueCapacity = options.BufferSize * options.QueueCapacityMultiplier;
        _channel = Channel.CreateBounded<LogEvent>(new BoundedChannelOptions(_queueCapacity)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false,
        });

        _ownsHttpClient = http is null;
        _http = http ?? new HttpClient { Timeout = options.RequestTimeout };

        _http.DefaultRequestHeaders.UserAgent.Clear();
        _http.DefaultRequestHeaders.UserAgent.Add(
            new ProductInfoHeaderValue("StackSift-SerilogSink", typeof(StackSiftSink).Assembly.GetName().Version?.ToString(3) ?? "0.1.0"));
        _http.DefaultRequestHeaders.Accept.Clear();
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        _worker = Task.Run(() => RunAsync(_cts.Token));
    }

    public void Emit(LogEvent logEvent)
    {
        if (Volatile.Read(ref _disposed) != 0) return;
        if (!_channel.Writer.TryWrite(logEvent))
        {
            Interlocked.Increment(ref _droppedCount);
        }
    }

    public void Dispose()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;

        _channel.Writer.TryComplete();

        try
        {
            if (!_worker.Wait(_options.ShutdownDrainTimeout))
            {
                _cts.Cancel();
                _worker.Wait(TimeSpan.FromSeconds(1));
            }
        }
        catch (AggregateException)
        {
        }

        _cts.Dispose();
        if (_ownsHttpClient) _http.Dispose();
    }

    private async Task RunAsync(CancellationToken ct)
    {
        var batch = new List<LogEvent>(_options.BufferSize);
        var reader = _channel.Reader;
        var flushTimer = Task.Delay(_options.FlushInterval, ct);

        while (!ct.IsCancellationRequested)
        {
            try
            {
                var readTask = reader.WaitToReadAsync(ct).AsTask();
                var winner = await Task.WhenAny(readTask, flushTimer).ConfigureAwait(false);

                if (winner == flushTimer)
                {
                    if (batch.Count > 0)
                    {
                        await SendBatchWithRetryAsync(batch, ct).ConfigureAwait(false);
                        batch.Clear();
                    }
                    flushTimer = Task.Delay(_options.FlushInterval, ct);
                    continue;
                }

                if (!await readTask.ConfigureAwait(false))
                {
                    if (batch.Count > 0)
                        await SendBatchWithRetryAsync(batch, ct).ConfigureAwait(false);
                    break;
                }

                while (batch.Count < _options.BufferSize && reader.TryRead(out var evt))
                {
                    batch.Add(evt);
                }

                if (batch.Count >= _options.BufferSize)
                {
                    await SendBatchWithRetryAsync(batch, ct).ConfigureAwait(false);
                    batch.Clear();
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                SelfLog.WriteLine("StackSiftSink worker loop error: {0}", ex);
            }
        }
    }

    private async Task SendBatchWithRetryAsync(IReadOnlyList<LogEvent> batch, CancellationToken ct)
    {
        var payload = PayloadBuilder.Build(
            _options.ProjectId,
            _options.LogSourceId,
            batch,
            _options.ServiceName,
            _options.HostName);

        var attempts = 0;
        var delay = _options.InitialRetryDelay;

        while (true)
        {
            attempts++;

            using var request = new HttpRequestMessage(HttpMethod.Post, _options.IngestUrl)
            {
                Content = new ByteArrayContent(payload)
                {
                    Headers = { ContentType = new MediaTypeHeaderValue("application/json") }
                }
            };
            request.Headers.TryAddWithoutValidation("X-Api-Key", _options.ApiKey);

            HttpResponseMessage? response = null;
            try
            {
                response = await _http.SendAsync(request, ct).ConfigureAwait(false);
                if ((int)response.StatusCode is >= 200 and < 300) return;

                if (response.StatusCode == HttpStatusCode.TooManyRequests)
                {
                    if (attempts > _options.MaxRetries)
                    {
                        Interlocked.Add(ref _droppedCount, batch.Count);
                        SelfLog.WriteLine("StackSiftSink: gave up after {0} 429 responses; dropped {1} events.", attempts, batch.Count);
                        return;
                    }
                    delay = ResolveRetryAfter(response) ?? NextBackoff(delay);
                    await Task.Delay(delay, ct).ConfigureAwait(false);
                    continue;
                }

                if ((int)response.StatusCode >= 500)
                {
                    if (attempts > _options.MaxRetries)
                    {
                        Interlocked.Add(ref _droppedCount, batch.Count);
                        SelfLog.WriteLine("StackSiftSink: gave up after {0} 5xx responses; dropped {1} events.", attempts, batch.Count);
                        return;
                    }
                    await Task.Delay(delay, ct).ConfigureAwait(false);
                    delay = NextBackoff(delay);
                    continue;
                }

                Interlocked.Add(ref _droppedCount, batch.Count);
                SelfLog.WriteLine(
                    "StackSiftSink: ingest endpoint returned non-retryable status {0}; dropped {1} events.",
                    (int)response.StatusCode, batch.Count);
                return;
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                if (attempts > _options.MaxRetries)
                {
                    Interlocked.Add(ref _droppedCount, batch.Count);
                    SelfLog.WriteLine("StackSiftSink: gave up after {0} timeouts; dropped {1} events.", attempts, batch.Count);
                    return;
                }
                await Task.Delay(delay, ct).ConfigureAwait(false);
                delay = NextBackoff(delay);
            }
            catch (OperationCanceledException)
            {
                Interlocked.Add(ref _droppedCount, batch.Count);
                return;
            }
            catch (HttpRequestException ex)
            {
                if (attempts > _options.MaxRetries)
                {
                    Interlocked.Add(ref _droppedCount, batch.Count);
                    SelfLog.WriteLine(
                        "StackSiftSink: HTTP error after {0} attempts ({1}); dropped {2} events.",
                        attempts, ex.Message, batch.Count);
                    return;
                }
                await Task.Delay(delay, ct).ConfigureAwait(false);
                delay = NextBackoff(delay);
            }
            finally
            {
                response?.Dispose();
            }
        }
    }

    private TimeSpan? ResolveRetryAfter(HttpResponseMessage response)
    {
        var retryAfter = response.Headers.RetryAfter;
        if (retryAfter is null) return null;
        if (retryAfter.Delta is { } delta) return delta;
        if (retryAfter.Date is { } date)
        {
            var diff = date - DateTimeOffset.UtcNow;
            if (diff > TimeSpan.Zero) return diff;
        }
        return null;
    }

    private TimeSpan NextBackoff(TimeSpan current)
    {
        var doubled = TimeSpan.FromMilliseconds(current.TotalMilliseconds * 2);
        return doubled > _options.MaxRetryDelay ? _options.MaxRetryDelay : doubled;
    }

    internal static void ResetDroppedCountForTesting() => Interlocked.Exchange(ref _droppedCount, 0);
}
