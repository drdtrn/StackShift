using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using StackSift.Application.Common;
using StackSift.Application.DTOs;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Tests.Integration;

/// <summary>
/// Integration tests for /api/v1/incidents against a real Postgres container.
/// Incidents are seeded directly via AppDbContext (they have no public POST endpoint —
/// they're created by the log-ingestion pipeline).
/// </summary>
[Collection("Integration")]
public class IncidentsControllerTests(StackSiftWebApplicationFactory factory) : IAsyncLifetime
{
    private HttpClient _adminOrgAClient = null!;
    private HttpClient _viewerOrgBClient = null!;

    private static readonly JsonSerializerOptions Jso = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
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

    // ── Helper: seed an incident directly via EF Core ─────────────────────────

    private async Task<Incident> SeedIncidentAsync(
        Guid orgId, IncidentStatus status = IncidentStatus.Open, Guid? projectId = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var incident = new Incident
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            ProjectId = projectId ?? Guid.NewGuid(),
            Title = $"Test Incident [{status}]",
            Status = status,
            Severity = AlertSeverity.High,
            StartedAt = DateTimeOffset.UtcNow,
        };

        db.Incidents.Add(incident);
        await db.SaveChangesAsync();
        return incident;
    }

    // ── GET list with status filter ───────────────────────────────────────────

    [Fact]
    public async Task GetIncidents_FilterByOpen_ReturnsOnlyOpenIncidents()
    {
        await SeedIncidentAsync(KeycloakTestRealmSeeder.OrgAId, IncidentStatus.Open);
        await SeedIncidentAsync(KeycloakTestRealmSeeder.OrgAId, IncidentStatus.Resolved);

        var resp = await _adminOrgAClient.GetAsync("/api/v1/incidents?status=open");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var page = await resp.Content.ReadFromJsonAsync<PaginatedResponse<IncidentDto>>(Jso);
        page!.Data.Should().AllSatisfy(i => i.Status.Should().Be(IncidentStatus.Open));
    }

    // ── GET by ID ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetIncident_Exists_Returns200()
    {
        var incident = await SeedIncidentAsync(KeycloakTestRealmSeeder.OrgAId);

        var resp = await _adminOrgAClient.GetAsync($"/api/v1/incidents/{incident.Id}");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto = await resp.Content.ReadFromJsonAsync<IncidentDto>(Jso);
        dto!.Id.Should().Be(incident.Id);
    }

    // ── PATCH status transitions ──────────────────────────────────────────────

    [Fact]
    public async Task PatchStatus_OpenToAcknowledged_Returns200()
    {
        var incident = await SeedIncidentAsync(KeycloakTestRealmSeeder.OrgAId, IncidentStatus.Open);

        var resp = await _adminOrgAClient.PatchAsJsonAsync(
            $"/api/v1/incidents/{incident.Id}/status",
            new { status = "acknowledged" });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<IncidentDto>(Jso);
        dto!.Status.Should().Be(IncidentStatus.Acknowledged);
        dto.AcknowledgedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task PatchStatus_AcknowledgedToResolved_Returns200()
    {
        var incident = await SeedIncidentAsync(KeycloakTestRealmSeeder.OrgAId, IncidentStatus.Acknowledged);

        var resp = await _adminOrgAClient.PatchAsJsonAsync(
            $"/api/v1/incidents/{incident.Id}/status",
            new { status = "resolved" });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<IncidentDto>(Jso);
        dto!.Status.Should().Be(IncidentStatus.Resolved);
        dto.ResolvedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task PatchStatus_ResolvedToOpen_Returns400()
    {
        var incident = await SeedIncidentAsync(KeycloakTestRealmSeeder.OrgAId, IncidentStatus.Resolved);

        var resp = await _adminOrgAClient.PatchAsJsonAsync(
            $"/api/v1/incidents/{incident.Id}/status",
            new { status = "open" });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── Cross-tenant GET → 404 ────────────────────────────────────────────────

    [Fact]
    public async Task GetIncident_WrongOrg_Returns404()
    {
        var incident = await SeedIncidentAsync(KeycloakTestRealmSeeder.OrgAId);

        // viewer@org-b should see 404 (org-a resource masked)
        var resp = await _viewerOrgBClient.GetAsync($"/api/v1/incidents/{incident.Id}");
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Cross-tenant PATCH status → 404 ──────────────────────────────────────

    [Fact]
    public async Task PatchStatus_WrongOrg_Returns404()
    {
        var incident = await SeedIncidentAsync(KeycloakTestRealmSeeder.OrgAId, IncidentStatus.Open);

        var resp = await _viewerOrgBClient.PatchAsJsonAsync(
            $"/api/v1/incidents/{incident.Id}/status",
            new { status = "acknowledged" });

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Cross-tenant POST analyze → 404 ──────────────────────────────────────

    [Fact]
    public async Task TriggerAnalysis_WrongOrg_Returns404()
    {
        var incident = await SeedIncidentAsync(KeycloakTestRealmSeeder.OrgAId, IncidentStatus.Open);

        var resp = await _viewerOrgBClient.PostAsJsonAsync(
            $"/api/v1/incidents/{incident.Id}/analyze",
            new { });

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
