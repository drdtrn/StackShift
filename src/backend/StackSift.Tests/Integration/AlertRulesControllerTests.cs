using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using StackSift.Application.DTOs;
using StackSift.Domain.Enums;

namespace StackSift.Tests.Integration;

/// <summary>
/// Cross-org isolation tests for /api/v1/alert-rules.
/// Org-B must not be able to read, modify, or delete Org-A's alert rules.
/// </summary>
[Collection("Integration")]
public class AlertRulesControllerTests(StackSiftWebApplicationFactory factory) : IAsyncLifetime
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

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<Guid> CreateOrgAProjectIdAsync()
    {
        var resp = await _adminOrgAClient.PostAsJsonAsync("/api/v1/projects",
            new { name = "Alert Rules Project", color = "#123456" });
        resp.EnsureSuccessStatusCode();
        var dto = (await resp.Content.ReadFromJsonAsync<ProjectDto>(new JsonSerializerOptions(JsonSerializerDefaults.Web)))!;
        return dto.Id;
    }

    private async Task<AlertRuleDto> CreateOrgAAlertRuleAsync(Guid projectId)
    {
        var resp = await _adminOrgAClient.PostAsJsonAsync("/api/v1/alert-rules", new
        {
            projectId,
            name = "High Error Rate",
            condition = "threshold",
            threshold = 10.0,
            windowMinutes = 5,
        });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<AlertRuleDto>(Jso))!;
    }

    // ── List isolation: Org-B querying Org-A's projectId gets empty list ──────

    [Fact]
    public async Task GetAlertRules_WrongOrgProjectId_ReturnsEmpty()
    {
        var projectId = await CreateOrgAProjectIdAsync();
        await CreateOrgAAlertRuleAsync(projectId);

        // OrgB asks for OrgA's projectId — must get nothing back
        var resp = await _viewerOrgBClient.GetAsync($"/api/v1/alert-rules?projectId={projectId}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var rules = await resp.Content.ReadFromJsonAsync<List<AlertRuleDto>>(Jso);
        rules.Should().BeEmpty();
    }

    // ── Cross-tenant PUT → 404 ────────────────────────────────────────────────

    [Fact]
    public async Task UpdateAlertRule_WrongOrg_Returns404()
    {
        var projectId = await CreateOrgAProjectIdAsync();
        var rule = await CreateOrgAAlertRuleAsync(projectId);

        var resp = await _viewerOrgBClient.PutAsJsonAsync($"/api/v1/alert-rules/{rule.Id}", new
        {
            name = "Hijacked Rule",
            condition = "threshold",
            threshold = 99.0,
            windowMinutes = 1,
            isActive = true,
        });

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Cross-tenant DELETE → 404 ─────────────────────────────────────────────

    [Fact]
    public async Task DeleteAlertRule_WrongOrg_Returns404()
    {
        var projectId = await CreateOrgAProjectIdAsync();
        var rule = await CreateOrgAAlertRuleAsync(projectId);

        var resp = await _viewerOrgBClient.DeleteAsync($"/api/v1/alert-rules/{rule.Id}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── OrganizationId in POST body is ignored — org is always from JWT ───────

    [Fact]
    public async Task CreateAlertRule_OrgIdInBodyIsIgnored_RuleBelongsToCallerOrg()
    {
        var projectId = await CreateOrgAProjectIdAsync();

        var resp = await _adminOrgAClient.PostAsJsonAsync("/api/v1/alert-rules", new
        {
            projectId,
            name = "Crafted Rule",
            condition = "threshold",
            threshold = 5.0,
            windowMinutes = 5,
            organizationId = KeycloakTestRealmSeeder.OrgBId, // injected — must be ignored
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await resp.Content.ReadFromJsonAsync<AlertRuleDto>(Jso);
        dto!.OrganizationId.Should().Be(KeycloakTestRealmSeeder.OrgAId);
    }
}
