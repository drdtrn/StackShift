using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Tests.Integration;

/// <summary>
/// Cross-org isolation tests for /api/v1/logs.
///
/// GET /api/v1/logs (read):
///   Log entries are stored in and queried from Elasticsearch, which is not
///   provisioned in the Testcontainers suite. Read-path isolation is verified by
///   code audit: GetLogEntriesQueryHandler always scopes ES queries to
///   ICurrentUserService.OrganizationId. See docs/multi-tenancy-verification.md.
///
/// POST /api/v1/logs/ingest (ingest):
///   The IngestLogBatchCommandHandler fetches the LogSource by ID and checks
///   logSource.OrganizationId == currentUser.OrganizationId before publishing.
///   This guard fires before IMessagePublisher (which is a no-op in tests), so
///   the cross-org 404 is fully testable without RabbitMQ.
/// </summary>
[Collection("Integration")]
public class LogEntriesControllerTests(StackSiftWebApplicationFactory factory) : IAsyncLifetime
{
    private HttpClient _adminOrgAClient = null!;
    private HttpClient _viewerOrgBClient = null!;

    public async Task InitializeAsync()
    {
        await factory.ResetDatabaseAsync();
        _adminOrgAClient = await factory.CreateAuthenticatedClientAsync(
            KeycloakTestRealmSeeder.AdminOrgAEmail,
            KeycloakTestRealmSeeder.AdminOrgAPassword);
        _viewerOrgBClient = await factory.CreateAuthenticatedClientAsync(
            KeycloakTestRealmSeeder.ViewerOrgBEmail,
            KeycloakTestRealmSeeder.ViewerOrgBPassword);
    }

    public Task DisposeAsync()
    {
        _adminOrgAClient.Dispose();
        _viewerOrgBClient.Dispose();
        return Task.CompletedTask;
    }

    // ── Seed helpers ──────────────────────────────────────────────────────────

    private async Task<LogSource> SeedLogSourceAsync(Guid orgId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var source = new LogSource
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            ProjectId = Guid.NewGuid(),
            Name = "Test Log Source",
            Type = LogSourceType.Application,
            IngestUrl = $"http://localhost/ingest/{Guid.NewGuid()}",
            ApiKey = Guid.NewGuid().ToString(),
            IsActive = true,
        };
        db.LogSources.Add(source);
        await db.SaveChangesAsync();
        return source;
    }

    // ── Cross-tenant ingest → 404 ─────────────────────────────────────────────
    //
    // OrgB sends a valid JWT but targets OrgA's LogSource.
    // IngestLogBatchCommandHandler throws NotFoundException before publishing.

    [Fact]
    public async Task IngestLogs_WrongOrgLogSource_Returns404()
    {
        var orgASource = await SeedLogSourceAsync(KeycloakTestRealmSeeder.OrgAId);

        var body = new
        {
            projectId = orgASource.ProjectId,
            logSourceId = orgASource.Id,
            entries = new[]
            {
                new
                {
                    level = "info",
                    message = "cross-org ingest attempt",
                    timestamp = DateTimeOffset.UtcNow,
                    traceId = (string?)null,
                    spanId = (string?)null,
                    serviceName = (string?)null,
                    hostName = (string?)null,
                    metadata = (object?)null,
                },
            },
        };

        var resp = await _viewerOrgBClient.PostAsJsonAsync("/api/v1/logs/ingest", body);

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Sanity: Org-A can ingest to its own log source ────────────────────────

    [Fact]
    public async Task IngestLogs_CorrectOrg_Returns202()
    {
        var orgASource = await SeedLogSourceAsync(KeycloakTestRealmSeeder.OrgAId);

        var body = new
        {
            projectId = orgASource.ProjectId,
            logSourceId = orgASource.Id,
            entries = new[]
            {
                new
                {
                    level = "info",
                    message = "valid ingest",
                    timestamp = DateTimeOffset.UtcNow,
                    traceId = (string?)null,
                    spanId = (string?)null,
                    serviceName = (string?)null,
                    hostName = (string?)null,
                    metadata = (object?)null,
                },
            },
        };

        var resp = await _adminOrgAClient.PostAsJsonAsync("/api/v1/logs/ingest", body);

        resp.StatusCode.Should().Be(HttpStatusCode.Accepted);
    }
}
