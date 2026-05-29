using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using MassTransit;
using Microsoft.Extensions.Logging;
using StackSift.Application.Messages;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Elasticsearch.LifecycleBootstrap;

namespace StackSift.Infrastructure.Messaging.Consumers;

public sealed class OrgPlanChangedConsumer(
    IHttpClientFactory httpClientFactory,
    ILogger<OrgPlanChangedConsumer> logger)
    : IConsumer<OrgPlanChangedMessage>
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    public async Task Consume(ConsumeContext<OrgPlanChangedMessage> context)
    {
        var msg = context.Message;
        var ct = context.CancellationToken;

        var policy = PolicyFor(msg.NewPlan);
        var indexName = $"stacksift-logs-{msg.OrganizationId}";

        try
        {
            var http = httpClientFactory.CreateClient(EsLifecycleBootstrap.HttpClientName);
            var payload = JsonSerializer.Serialize(new
            {
                index = new Dictionary<string, object>
                {
                    ["lifecycle.name"] = policy,
                }
            }, JsonOpts);

            using var content = new StringContent(payload, Encoding.UTF8, "application/json");
            using var response = await http.PutAsync($"/{indexName}/_settings", content, ct);

            if (response.IsSuccessStatusCode)
            {
                logger.LogInformation(
                    "OrgPlanChangedConsumer: org {OrgId} plan {Plan} — applied ILM {Policy} to {Index}.",
                    msg.OrganizationId, msg.NewPlan, policy, indexName);
                return;
            }

            // Index may not exist yet (org has never ingested) — that is benign:
            // the template default applies whenever the index is first created.
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                logger.LogInformation(
                    "OrgPlanChangedConsumer: org {OrgId} index {Index} does not exist yet — next ingest picks up template default.",
                    msg.OrganizationId, indexName);
                return;
            }

            var body = await response.Content.ReadAsStringAsync(ct);
            logger.LogWarning(
                "OrgPlanChangedConsumer: org {OrgId} — ES rejected ILM swap to {Policy} on {Index}: {Status} {Body}",
                msg.OrganizationId, policy, indexName, (int)response.StatusCode, body);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "OrgPlanChangedConsumer: org {OrgId} — failed to apply ILM {Policy} to {Index}.",
                msg.OrganizationId, policy, indexName);
        }
    }

    internal static string PolicyFor(Plan plan) => plan switch
    {
        Plan.Free => "stacksift-logs-free",
        Plan.Indie => "stacksift-logs-indie",
        Plan.Team => "stacksift-logs-team",
        _ => "stacksift-logs-free",
    };
}
