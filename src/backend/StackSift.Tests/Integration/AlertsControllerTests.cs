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
/// Cross-org isolation tests for /api/v1/alerts.
/// Org-B must not be able to read or acknowledge Org-A's alerts.
/// </summary>
[Collection("Integration")]
public class AlertsControllerTests(StackSiftWebApplicationFactory factory) : IAsyncLifetime
{
    private HttpClient _adminOrgAClient = null!;
    private HttpClient _viewerOrgBClient = null!;
    private HttpClient _adminOrgBClient = null!;

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
        _adminOrgBClient = await factory.CreateAuthenticatedClientAsync(
            KeycloakTestRealmSeeder.AdminOrgBEmail,
            KeycloakTestRealmSeeder.AdminOrgBPassword);
    }

    public Task DisposeAsync()
    {
        _adminOrgAClient.Dispose();
        _viewerOrgBClient.Dispose();
        _adminOrgBClient.Dispose();
        return Task.CompletedTask;
    }

    // ── Seed helper ───────────────────────────────────────────────────────────

    private async Task<Alert> SeedAlertAsync(Guid orgId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var alert = new Alert
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            ProjectId = Guid.NewGuid(),
            Severity = AlertSeverity.High,
            Title = $"Test Alert [{orgId}]",
            Description = "Integration test alert",
            FiredAt = DateTimeOffset.UtcNow,
        };

        db.Alerts.Add(alert);
        await db.SaveChangesAsync();
        return alert;
    }

    // ── List isolation: Org-B's alert list must not contain Org-A's alerts ────

    [Fact]
    public async Task GetAlerts_WrongOrg_ListIsIsolated()
    {
        await SeedAlertAsync(KeycloakTestRealmSeeder.OrgAId);

        var resp = await _viewerOrgBClient.GetAsync("/api/v1/alerts?page=1&pageSize=50");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var page = await resp.Content.ReadFromJsonAsync<PaginatedResponse<AlertDto>>(Jso);
        page!.Data.Should().NotContain(a => a.OrganizationId == KeycloakTestRealmSeeder.OrgAId);
    }

    // ── Cross-tenant GET by ID → 404 ─────────────────────────────────────────

    [Fact]
    public async Task GetAlert_WrongOrg_Returns404()
    {
        var alert = await SeedAlertAsync(KeycloakTestRealmSeeder.OrgAId);

        var resp = await _viewerOrgBClient.GetAsync($"/api/v1/alerts/{alert.Id}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Cross-tenant PATCH acknowledge → 404 ─────────────────────────────────
    // Uses AdminOrgB: PATCH requires MemberOrAbove; viewer would get 403 before handler org check.

    [Fact]
    public async Task AcknowledgeAlert_WrongOrg_Returns404()
    {
        var alert = await SeedAlertAsync(KeycloakTestRealmSeeder.OrgAId);

        var resp = await _adminOrgBClient.PatchAsync(
            $"/api/v1/alerts/{alert.Id}/acknowledge",
            new StringContent(string.Empty));

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
