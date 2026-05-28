using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Nodes;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using StackSift.Application.DTOs;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Tests.Integration;

[Collection("Integration")]
public class LogSourcesControllerTests(StackSiftWebApplicationFactory factory) : IAsyncLifetime
{
    private HttpClient _adminOrgAClient = null!;
    private HttpClient _adminOrgBClient = null!;
    private HttpClient _viewerOrgBClient = null!;

    private static readonly JsonSerializerOptions Jso = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    public async Task InitializeAsync()
    {
        await factory.ResetDatabaseAsync();
        _adminOrgAClient = await factory.CreateAuthenticatedClientAsync(
            KeycloakTestRealmSeeder.AdminOrgAEmail,
            KeycloakTestRealmSeeder.AdminOrgAPassword);
        _adminOrgBClient = await factory.CreateAuthenticatedClientAsync(
            KeycloakTestRealmSeeder.AdminOrgBEmail,
            KeycloakTestRealmSeeder.AdminOrgBPassword);
        _viewerOrgBClient = await factory.CreateAuthenticatedClientAsync(
            KeycloakTestRealmSeeder.ViewerOrgBEmail,
            KeycloakTestRealmSeeder.ViewerOrgBPassword);
    }

    public Task DisposeAsync()
    {
        _adminOrgAClient.Dispose();
        _adminOrgBClient.Dispose();
        _viewerOrgBClient.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task Create_HappyPath_Returns201WithCreatedDto()
    {
        var project = await CreateProjectAsync();

        var created = await CreateLogSourceAsync(project.Id);

        created.ApiKey.Should().StartWith("ss_");
        created.ApiKey.Should().HaveLength(35);
        created.LogSource.KeyPrefix.Should().Be(created.ApiKey[..8]);
    }

    [Fact]
    public async Task Create_WrongOrgProject_Returns404()
    {
        var project = await CreateProjectAsync();

        var resp = await _adminOrgBClient.PostAsJsonAsync(
            $"/api/v1/projects/{project.Id}/log-sources",
            new { name = "Wrong Org", type = "application" });

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Get_ReturnsPrefixOnly()
    {
        var project = await CreateProjectAsync();
        var created = await CreateLogSourceAsync(project.Id);

        var singleResp = await _adminOrgAClient.GetAsync($"/api/v1/log-sources/{created.LogSource.Id}");
        var listResp = await _adminOrgAClient.GetAsync($"/api/v1/projects/{project.Id}/log-sources");

        singleResp.StatusCode.Should().Be(HttpStatusCode.OK);
        listResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var singleJson = JsonNode.Parse(await singleResp.Content.ReadAsStringAsync())!.AsObject();
        var listJson = JsonNode.Parse(await listResp.Content.ReadAsStringAsync())!.AsArray();

        singleJson.ContainsKey("apiKey").Should().BeFalse();
        singleJson["keyPrefix"]!.GetValue<string>().Should().Be(created.ApiKey[..8]);
        listJson[0]!.AsObject().ContainsKey("apiKey").Should().BeFalse();
    }

    [Fact]
    public async Task Regenerate_HappyPath_OldKeyImmediatelyRejected()
    {
        var project = await CreateProjectAsync();
        var created = await CreateLogSourceAsync(project.Id);

        var resp = await _adminOrgAClient.PostAsync(
            $"/api/v1/log-sources/{created.LogSource.Id}/regenerate-key", null);
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var regenerated = (await resp.Content.ReadFromJsonAsync<LogSourceCreatedDto>(Jso))!;

        var oldKeyResp = await IngestWithApiKeyAsync(created.ApiKey, regenerated.LogSource);
        var newKeyResp = await IngestWithApiKeyAsync(regenerated.ApiKey, regenerated.LogSource);

        oldKeyResp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        newKeyResp.StatusCode.Should().Be(HttpStatusCode.Accepted);
    }

    [Fact]
    public async Task Regenerate_WrongOrg_Returns404()
    {
        var project = await CreateProjectAsync();
        var created = await CreateLogSourceAsync(project.Id);

        var resp = await _adminOrgBClient.PostAsync(
            $"/api/v1/log-sources/{created.LogSource.Id}/regenerate-key", null);

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Regenerate_AsViewer_Returns403()
    {
        var project = await CreateProjectAsync();
        var created = await CreateLogSourceAsync(project.Id);

        var resp = await _viewerOrgBClient.PostAsync(
            $"/api/v1/log-sources/{created.LogSource.Id}/regenerate-key", null);

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Delete_HappyPath_RemovesFromListAndRejectsIngestion()
    {
        var project = await CreateProjectAsync();
        var created = await CreateLogSourceAsync(project.Id);

        var deleteResp = await _adminOrgAClient.DeleteAsync($"/api/v1/log-sources/{created.LogSource.Id}");
        var listResp = await _adminOrgAClient.GetAsync($"/api/v1/projects/{project.Id}/log-sources");
        var ingestResp = await IngestWithApiKeyAsync(created.ApiKey, created.LogSource);

        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);
        listResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var listJson = JsonNode.Parse(await listResp.Content.ReadAsStringAsync())!.AsArray();
        listJson.Should().BeEmpty();
        ingestResp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Delete_AsViewer_Returns403()
    {
        var project = await CreateProjectAsync();
        var created = await CreateLogSourceAsync(project.Id);

        var resp = await _viewerOrgBClient.DeleteAsync($"/api/v1/log-sources/{created.LogSource.Id}");

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task TestIngest_HappyPath_Returns200WithSyntheticId()
    {
        var project = await CreateProjectAsync();
        var created = await CreateLogSourceAsync(project.Id);

        var resp = await PostTestIngestAsync(created.LogSource.Id, Guid.NewGuid().ToString("N"));

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = (await resp.Content.ReadFromJsonAsync<TestIngestResultDto>(Jso))!;
        result.SyntheticId.Should().NotBeEmpty();
    }

    [Fact]
    public async Task TestIngest_RateLimited_Returns429AfterBucketEmpty()
    {
        var project = await CreateProjectAsync();
        var created = await CreateLogSourceAsync(project.Id);
        HttpResponseMessage? last = null;

        var partition = Guid.NewGuid().ToString("N");
        for (var i = 0; i < 101; i++)
            last = await PostTestIngestAsync(created.LogSource.Id, partition);

        last!.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task AuditLog_RecordsCreateRegenerateAndDelete()
    {
        var project = await CreateProjectAsync();
        var created = await CreateLogSourceAsync(project.Id);
        await _adminOrgAClient.PostAsync($"/api/v1/log-sources/{created.LogSource.Id}/regenerate-key", null);
        await _adminOrgAClient.DeleteAsync($"/api/v1/log-sources/{created.LogSource.Id}");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var events = await db.AuditLogEntries
            .Where(e => e.LogSourceId == created.LogSource.Id)
            .Select(e => e.Event)
            .ToListAsync();

        events.Should().Contain(AuditEvent.LogSourceKeyCreated);
        events.Should().Contain(AuditEvent.LogSourceKeyRevealed);
        events.Should().Contain(AuditEvent.LogSourceKeyRegenerated);
        events.Should().Contain(AuditEvent.LogSourceDeleted);
    }

    [Fact]
    public async Task MigrationBackfill_RoundTrip_PreservesOriginalKeyAuthentication()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var migrator = db.Database.GetService<IMigrator>();
        const string previousMigration = "20260524182311_AddInvitationsAndInvitedBy";
        const string pepper = "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=";
        const string apiKey = "ss_backfilltestkey123456789012345";
        var sourceId = Guid.NewGuid();
        var projectId = Guid.NewGuid();

        try
        {
            await migrator.MigrateAsync(previousMigration);
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO "LogSources"
                ("Id", "ProjectId", "OrganizationId", "Name", "Type", "IngestUrl", "ApiKey", "IsActive", "LastSeenAt", "CreatedAt", "UpdatedAt", "CreatedBy", "IsDeleted", "DeletedAt", "DeletedBy")
                VALUES
                ({sourceId}, {projectId}, {KeycloakTestRealmSeeder.OrgAId}, 'Backfill source', 'Application', '/api/v1/logs/ingest', {apiKey}, true, NULL, now(), now(), 'test', false, NULL, NULL);
                """);

            await db.Database.OpenConnectionAsync();
            try
            {
                await db.Database.ExecuteSqlInterpolatedAsync($"SELECT set_config('app.log_sources_key_pepper_base64', {pepper}, false);");
                await migrator.MigrateAsync();
            }
            finally
            {
                await db.Database.CloseConnectionAsync();
            }

            var rows = await db.LogSources
                .Where(source => source.Id == sourceId)
                .Select(source => new { source.KeyHash, source.KeyPrefix })
                .SingleAsync();
            rows.KeyHash.Should().NotBeNullOrWhiteSpace();
            rows.KeyPrefix.Should().Be(apiKey[..8]);

            var ingestResp = await IngestWithApiKeyAsync(apiKey, new LogSourceDto(
                sourceId,
                projectId,
                KeycloakTestRealmSeeder.OrgAId,
                "Backfill source",
                LogSourceType.Application,
                "/api/v1/logs/ingest",
                apiKey[..8],
                null,
                null,
                true,
                null,
                DateTimeOffset.UtcNow));

            ingestResp.StatusCode.Should().Be(HttpStatusCode.Accepted);
        }
        finally
        {
            await migrator.MigrateAsync();
        }
    }

    private async Task<ProjectDto> CreateProjectAsync()
    {
        var resp = await _adminOrgAClient.PostAsJsonAsync("/api/v1/projects",
            new { name = $"Project {Guid.NewGuid():N}", color = "#123456" });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<ProjectDto>(Jso))!;
    }

    private async Task<LogSourceCreatedDto> CreateLogSourceAsync(Guid projectId)
    {
        var resp = await _adminOrgAClient.PostAsJsonAsync(
            $"/api/v1/projects/{projectId}/log-sources",
            new { name = $"Source {Guid.NewGuid():N}", type = "application" });
        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        return (await resp.Content.ReadFromJsonAsync<LogSourceCreatedDto>(Jso))!;
    }

    private async Task<HttpResponseMessage> PostTestIngestAsync(Guid logSourceId, string partition)
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/v1/log-sources/{logSourceId}/test-ingest");
        request.Headers.Add("X-API-Key", partition);
        return await _adminOrgAClient.SendAsync(request);
    }

    private async Task<HttpResponseMessage> IngestWithApiKeyAsync(string apiKey, LogSourceDto source)
    {
        using var client = factory.CreateUnauthenticatedClient();
        client.DefaultRequestHeaders.Add("X-API-Key", apiKey);
        return await client.PostAsJsonAsync("/api/v1/logs/ingest", new
        {
            projectId = source.ProjectId,
            logSourceId = source.Id,
            entries = new[]
            {
                new
                {
                    level = "info",
                    message = "integration test ingest",
                    timestamp = DateTimeOffset.UtcNow,
                    traceId = (string?)null,
                    spanId = (string?)null,
                    serviceName = "tests",
                    hostName = "localhost",
                    metadata = (object?)null,
                },
            },
        });
    }
}
