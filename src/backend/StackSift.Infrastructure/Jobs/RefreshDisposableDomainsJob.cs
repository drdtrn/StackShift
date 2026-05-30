using Hangfire;
using Microsoft.Extensions.Logging;
using StackSift.Infrastructure.Abuse;

namespace StackSift.Infrastructure.Jobs;

public sealed class RefreshDisposableDomainsJob(
    IHttpClientFactory httpClientFactory,
    DisposableEmailBlocklist blocklist,
    ILogger<RefreshDisposableDomainsJob> logger)
{
    private const string ListUrl =
        "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf";

    [AutomaticRetry(Attempts = 2)]
    public async Task ExecuteAsync(CancellationToken ct)
    {
        try
        {
            var client = httpClientFactory.CreateClient();
            var text = await client.GetStringAsync(ListUrl, ct);
            var domains = text
                .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(line => !line.StartsWith('#'))
                .ToList();

            if (domains.Count == 0)
            {
                logger.LogWarning("RefreshDisposableDomainsJob: remote list was empty; keeping current set.");
                return;
            }

            blocklist.Replace(domains);
            logger.LogInformation("RefreshDisposableDomainsJob: loaded {Count} disposable domains.", domains.Count);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "RefreshDisposableDomainsJob: refresh failed; keeping current set of {Count}.", blocklist.Count);
        }
    }
}
