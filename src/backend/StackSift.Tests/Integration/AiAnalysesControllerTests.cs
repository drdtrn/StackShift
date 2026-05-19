using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using StackSift.Application.DTOs;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Tests.Integration;

/// <summary>
/// Cross-org isolation tests for /api/v1/ai-analyses.
/// Org-B must not be able to read Org-A's AI analyses.
/// </summary>
[Collection("Integration")]
public class AiAnalysesControllerTests(StackSiftWebApplicationFactory factory) : IAsyncLifetime
{
    private HttpClient _adminOrgAClient = null!;
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

    private async Task<Incident> SeedIncidentAsync(Guid orgId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var incident = new Incident
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            ProjectId = Guid.NewGuid(),
            Title = "Seed Incident for AI Analysis",
            Status = IncidentStatus.Open,
            Severity = AlertSeverity.High,
            StartedAt = DateTimeOffset.UtcNow,
        };
        db.Incidents.Add(incident);
        await db.SaveChangesAsync();
        return incident;
    }

    private async Task<AiAnalysis> SeedAiAnalysisAsync(Guid orgId, Guid incidentId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var analysis = new AiAnalysis
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            IncidentId = incidentId,
            Status = AiAnalysisStatus.Pending,
        };
        db.AiAnalyses.Add(analysis);
        await db.SaveChangesAsync();
        return analysis;
    }

    // ── Cross-tenant GET by ID → 404 ─────────────────────────────────────────

    [Fact]
    public async Task GetAiAnalysis_WrongOrg_Returns404()
    {
        var incident = await SeedIncidentAsync(KeycloakTestRealmSeeder.OrgAId);
        var analysis = await SeedAiAnalysisAsync(KeycloakTestRealmSeeder.OrgAId, incident.Id);

        var resp = await _viewerOrgBClient.GetAsync($"/api/v1/ai-analyses/{analysis.Id}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Sanity: Org-A can read its own analysis ───────────────────────────────

    [Fact]
    public async Task GetAiAnalysis_CorrectOrg_Returns200()
    {
        var incident = await SeedIncidentAsync(KeycloakTestRealmSeeder.OrgAId);
        var analysis = await SeedAiAnalysisAsync(KeycloakTestRealmSeeder.OrgAId, incident.Id);

        var resp = await _adminOrgAClient.GetAsync($"/api/v1/ai-analyses/{analysis.Id}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<AiAnalysisDto>(Jso);
        dto!.Id.Should().Be(analysis.Id);
    }
}
