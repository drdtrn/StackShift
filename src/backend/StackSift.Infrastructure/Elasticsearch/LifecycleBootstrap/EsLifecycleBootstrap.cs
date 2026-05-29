using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace StackSift.Infrastructure.Elasticsearch.LifecycleBootstrap;

public sealed class EsLifecycleBootstrap(
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<EsLifecycleBootstrap> log) : IHostedService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public const string HttpClientName = "elasticsearch-admin";

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            var options = configuration.GetSection("Elasticsearch:Lifecycle").Get<LifecycleOptions>() ?? new LifecycleOptions();

            if (!options.Enabled)
            {
                log.LogInformation("EsLifecycleBootstrap disabled via configuration; skipping.");
                return;
            }

            var http = httpClientFactory.CreateClient(HttpClientName);

            log.LogInformation(
                "EsLifecycleBootstrap registering SLM repo + ILM policies + template (default: {Policy}).",
                options.DefaultPolicy);

            await PutSnapshotRepositoryAsync(http, options, cancellationToken);
            await PutSlmPolicyAsync(http, options, cancellationToken);
            await PutIlmPoliciesAsync(http, options, cancellationToken);
            await PutIndexTemplateAsync(http, options, cancellationToken);

            log.LogInformation("EsLifecycleBootstrap completed.");
        }
        catch (Exception ex)
        {
            log.LogError(ex, "EsLifecycleBootstrap failed; will retry on next boot.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private static Task PutSnapshotRepositoryAsync(HttpClient http, LifecycleOptions options, CancellationToken ct) =>
        PutJsonAsync(http, $"/_snapshot/{options.SnapshotRepository.Name}", new
        {
            type = options.SnapshotRepository.Type,
            settings = new
            {
                bucket = options.SnapshotRepository.Bucket,
                endpoint = options.SnapshotRepository.Endpoint,
                region = options.SnapshotRepository.Region,
                compress = true,
                server_side_encryption = options.SnapshotRepository.ServerSideEncryption,
                base_path = options.SnapshotRepository.BasePath,
                path_style_access = options.SnapshotRepository.PathStyleAccess,
            }
        }, ct);

    private static Task PutSlmPolicyAsync(HttpClient http, LifecycleOptions options, CancellationToken ct) =>
        PutJsonAsync(http, "/_slm/policy/daily-logs", new
        {
            schedule = "0 30 1 * * ?",
            name = "<stacksift-logs-{now/d}>",
            repository = options.SnapshotRepository.Name,
            config = new
            {
                indices = new[] { "stacksift-logs-*" },
                include_global_state = false
            },
            retention = new
            {
                expire_after = "35d",
                min_count = 7,
                max_count = 60
            }
        }, ct);

    private static async Task PutIlmPoliciesAsync(HttpClient http, LifecycleOptions options, CancellationToken ct)
    {
        await PutJsonAsync(http, "/_ilm/policy/stacksift-logs-free", new
        {
            policy = new
            {
                phases = new
                {
                    hot = new { actions = new { rollover = new { max_age = "1d", max_size = "5gb" } } },
                    delete = new { min_age = "3d", actions = new { delete = new { } } }
                }
            }
        }, ct);

        await PutJsonAsync(http, "/_ilm/policy/stacksift-logs-indie", new
        {
            policy = new
            {
                phases = new
                {
                    hot = new { actions = new { rollover = new { max_age = "7d", max_size = "50gb" } } },
                    warm = new
                    {
                        min_age = "7d",
                        actions = new
                        {
                            shrink = new { number_of_shards = 1 },
                            forcemerge = new { max_num_segments = 1 }
                        }
                    },
                    delete = new { min_age = "30d", actions = new { delete = new { } } }
                }
            }
        }, ct);

        object teamPolicy = options.TeamSearchableSnapshotsEnabled
            ? new
            {
                policy = new
                {
                    phases = new
                    {
                        hot = new { actions = new { rollover = new { max_age = "7d", max_size = "50gb" } } },
                        warm = new
                        {
                            min_age = "14d",
                            actions = new
                            {
                                shrink = new { number_of_shards = 1 },
                                forcemerge = new { max_num_segments = 1 }
                            }
                        },
                        cold = new
                        {
                            min_age = "30d",
                            actions = new
                            {
                                searchable_snapshot = new { snapshot_repository = options.SnapshotRepository.Name }
                            }
                        },
                        delete = new { min_age = "90d", actions = new { delete = new { } } }
                    }
                }
            }
            : new
            {
                policy = new
                {
                    phases = new
                    {
                        hot = new { actions = new { rollover = new { max_age = "7d", max_size = "50gb" } } },
                        warm = new
                        {
                            min_age = "14d",
                            actions = new
                            {
                                shrink = new { number_of_shards = 1 },
                                forcemerge = new { max_num_segments = 1 }
                            }
                        },
                        delete = new { min_age = "90d", actions = new { delete = new { } } }
                    }
                }
            };

        await PutJsonAsync(http, "/_ilm/policy/stacksift-logs-team", teamPolicy, ct);
    }

    private static Task PutIndexTemplateAsync(HttpClient http, LifecycleOptions options, CancellationToken ct) =>
        PutJsonAsync(http, "/_index_template/stacksift-logs", new
        {
            index_patterns = new[] { "stacksift-logs-*" },
            priority = 100,
            template = new
            {
                settings = new Dictionary<string, object>
                {
                    ["index.lifecycle.name"] = options.DefaultPolicy,
                    ["index.number_of_shards"] = options.NumberOfShards,
                    ["index.number_of_replicas"] = options.NumberOfReplicas,
                }
            }
        }, ct);

    private static async Task PutJsonAsync(HttpClient http, string path, object body, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(body, JsonOpts);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        using var response = await http.PutAsync(path, content, ct);
        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException(
                $"ES PUT {path} failed: {(int)response.StatusCode} {response.ReasonPhrase} — {errorBody}");
        }
    }
}
