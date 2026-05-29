using System.Collections.Concurrent;
using System.Net;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using StackSift.Infrastructure.Elasticsearch.LifecycleBootstrap;
using Xunit;

namespace StackSift.Tests.Infrastructure.Elasticsearch;

public sealed class EsLifecycleBootstrapTests
{
    [Fact]
    public async Task StartAsync_registers_repo_slm_three_ilm_policies_and_template()
    {
        var captured = new ConcurrentBag<CapturedRequest>();
        var handler = new RecordingHandler(captured, HttpStatusCode.OK);
        var http = new HttpClient(handler) { BaseAddress = new Uri("http://es:9200") };

        var factory = new SingleHttpClientFactory(EsLifecycleBootstrap.HttpClientName, http);
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Elasticsearch:Lifecycle:Enabled"] = "true",
                ["Elasticsearch:Lifecycle:DefaultPolicy"] = "stacksift-logs-free",
                ["Elasticsearch:Lifecycle:NumberOfShards"] = "1",
                ["Elasticsearch:Lifecycle:NumberOfReplicas"] = "0",
                ["Elasticsearch:Lifecycle:SnapshotRepository:Name"] = "stacksift-logs-repo",
                ["Elasticsearch:Lifecycle:SnapshotRepository:Bucket"] = "stacksift-es-backup",
                ["Elasticsearch:Lifecycle:SnapshotRepository:Endpoint"] = "minio:9000",
            })
            .Build();

        var sut = new EsLifecycleBootstrap(factory, config, NullLogger<EsLifecycleBootstrap>.Instance);
        await sut.StartAsync(CancellationToken.None);

        captured.Should().HaveCount(6,
            "1 repo + 1 SLM policy + 3 ILM policies + 1 index template");

        var paths = captured.Select(c => c.Path).ToList();
        paths.Should().Contain("/_snapshot/stacksift-logs-repo");
        paths.Should().Contain("/_slm/policy/daily-logs");
        paths.Should().Contain("/_ilm/policy/stacksift-logs-free");
        paths.Should().Contain("/_ilm/policy/stacksift-logs-indie");
        paths.Should().Contain("/_ilm/policy/stacksift-logs-team");
        paths.Should().Contain("/_index_template/stacksift-logs");
    }

    [Fact]
    public async Task StartAsync_when_disabled_makes_no_http_calls()
    {
        var captured = new ConcurrentBag<CapturedRequest>();
        var handler = new RecordingHandler(captured, HttpStatusCode.OK);
        var http = new HttpClient(handler) { BaseAddress = new Uri("http://es:9200") };
        var factory = new SingleHttpClientFactory(EsLifecycleBootstrap.HttpClientName, http);

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Elasticsearch:Lifecycle:Enabled"] = "false",
            })
            .Build();

        var sut = new EsLifecycleBootstrap(factory, config, NullLogger<EsLifecycleBootstrap>.Instance);
        await sut.StartAsync(CancellationToken.None);

        captured.Should().BeEmpty();
    }

    [Fact]
    public async Task StartAsync_team_policy_includes_searchable_snapshot_phase_when_enabled()
    {
        var captured = new ConcurrentBag<CapturedRequest>();
        var handler = new RecordingHandler(captured, HttpStatusCode.OK);
        var http = new HttpClient(handler) { BaseAddress = new Uri("http://es:9200") };
        var factory = new SingleHttpClientFactory(EsLifecycleBootstrap.HttpClientName, http);

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Elasticsearch:Lifecycle:Enabled"] = "true",
                ["Elasticsearch:Lifecycle:TeamSearchableSnapshotsEnabled"] = "true",
                ["Elasticsearch:Lifecycle:SnapshotRepository:Name"] = "repo-x",
            })
            .Build();

        var sut = new EsLifecycleBootstrap(factory, config, NullLogger<EsLifecycleBootstrap>.Instance);
        await sut.StartAsync(CancellationToken.None);

        var teamPolicy = captured.Single(c => c.Path == "/_ilm/policy/stacksift-logs-team");
        teamPolicy.Body.Should().Contain("searchable_snapshot");
        teamPolicy.Body.Should().Contain("repo-x");
    }

    private sealed record CapturedRequest(string Method, string Path, string Body);

    private sealed class RecordingHandler(
        ConcurrentBag<CapturedRequest> captured, HttpStatusCode status) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = request.Content is not null
                ? await request.Content.ReadAsStringAsync(cancellationToken)
                : string.Empty;
            captured.Add(new CapturedRequest(
                request.Method.Method,
                request.RequestUri!.PathAndQuery,
                body));
            return new HttpResponseMessage(status)
            {
                Content = new StringContent("{}"),
            };
        }
    }

    private sealed class SingleHttpClientFactory(string name, HttpClient client) : IHttpClientFactory
    {
        public HttpClient CreateClient(string clientName)
        {
            if (clientName != name)
                throw new InvalidOperationException(
                    $"Unexpected client name: {clientName} (expected {name}).");
            return client;
        }
    }
}
