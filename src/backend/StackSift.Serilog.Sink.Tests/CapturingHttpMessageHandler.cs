using System.Net;
using System.Text;

namespace StackSift.Serilog.Sink.Tests;

internal sealed class CapturingHttpMessageHandler : HttpMessageHandler
{
    private readonly Func<HttpRequestMessage, int, HttpResponseMessage> _responder;
    private int _callCount;

    public List<CapturedRequest> Requests { get; } = [];
    public List<DateTimeOffset> CallTimestamps { get; } = [];

    public CapturingHttpMessageHandler(HttpStatusCode constantStatus)
        : this((_, _) => new HttpResponseMessage(constantStatus)) { }

    public CapturingHttpMessageHandler(Func<HttpRequestMessage, int, HttpResponseMessage> responder)
    {
        _responder = responder;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var attempt = Interlocked.Increment(ref _callCount);
        CallTimestamps.Add(DateTimeOffset.UtcNow);

        var body = request.Content is null
            ? string.Empty
            : await request.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);

        var apiKey = request.Headers.TryGetValues("X-Api-Key", out var keys)
            ? string.Join(',', keys)
            : null;

        Requests.Add(new CapturedRequest(request.Method, request.RequestUri!, body, apiKey));
        return _responder(request, attempt);
    }

    public sealed record CapturedRequest(HttpMethod Method, Uri Uri, string Body, string? ApiKey)
    {
        public string BodyUtf8 => Body;
        public byte[] BodyBytes => Encoding.UTF8.GetBytes(Body);
    }
}
