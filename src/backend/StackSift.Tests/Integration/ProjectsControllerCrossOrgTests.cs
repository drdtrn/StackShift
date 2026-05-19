using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using StackSift.Application.Common;
using StackSift.Application.DTOs;

namespace StackSift.Tests.Integration;

/// <summary>
/// Cross-org isolation tests for /api/v1/projects and /api/v1/projects/{id}/log-sources.
/// Every read or write on an Org-A resource attempted by an Org-B principal must return 404,
/// not 403 — 403 leaks resource existence.
/// </summary>
[Collection("Integration")]
public class ProjectsControllerCrossOrgTests(StackSiftWebApplicationFactory factory) : IAsyncLifetime
{
    private HttpClient _adminOrgAClient = null!;
    private HttpClient _viewerOrgBClient = null!;
    private HttpClient _adminOrgBClient = null!;

    private static readonly JsonSerializerOptions Jso = new(JsonSerializerDefaults.Web);

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

    private async Task<ProjectDto> CreateOrgAProjectAsync(string name = "Org-A Project")
    {
        var resp = await _adminOrgAClient.PostAsJsonAsync("/api/v1/projects",
            new { name, color = "#FF0000" });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<ProjectDto>(Jso))!;
    }

    // ── Cross-tenant GET by ID → 404 ─────────────────────────────────────────

    [Fact]
    public async Task GetProject_WrongOrg_Returns404()
    {
        var project = await CreateOrgAProjectAsync();

        var resp = await _viewerOrgBClient.GetAsync($"/api/v1/projects/{project.Id}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Cross-tenant PUT → 404 ────────────────────────────────────────────────
    // Uses AdminOrgB: PUT requires MemberOrAbove; viewer would get 403 before handler org check.

    [Fact]
    public async Task UpdateProject_WrongOrg_Returns404()
    {
        var project = await CreateOrgAProjectAsync();

        var resp = await _adminOrgBClient.PutAsJsonAsync(
            $"/api/v1/projects/{project.Id}",
            new { name = "Hijacked Name", color = "#000000" });

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Cross-tenant DELETE → 404 ─────────────────────────────────────────────

    [Fact]
    public async Task DeleteProject_WrongOrg_Returns404()
    {
        var project = await CreateOrgAProjectAsync();

        var resp = await _adminOrgBClient.DeleteAsync($"/api/v1/projects/{project.Id}");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Cross-tenant log-sources GET → 404 ───────────────────────────────────

    [Fact]
    public async Task GetLogSources_WrongOrg_Returns404()
    {
        var project = await CreateOrgAProjectAsync();

        var resp = await _adminOrgBClient.GetAsync($"/api/v1/projects/{project.Id}/log-sources");

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Cross-tenant log-source POST → 404 ───────────────────────────────────

    [Fact]
    public async Task CreateLogSource_WrongOrg_Returns404()
    {
        var project = await CreateOrgAProjectAsync();

        var resp = await _adminOrgBClient.PostAsJsonAsync(
            $"/api/v1/projects/{project.Id}/log-sources",
            new { name = "Injected Source", type = "application" });

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── List isolation: Org-B's list must not include Org-A's projects ────────

    [Fact]
    public async Task GetProjects_WrongOrg_ListIsIsolated()
    {
        await CreateOrgAProjectAsync("Org-A Secret");

        var resp = await _viewerOrgBClient.GetAsync("/api/v1/projects?page=1&pageSize=50");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var page = await resp.Content.ReadFromJsonAsync<PaginatedResponse<ProjectDto>>(Jso);
        page!.Data.Should().NotContain(p => p.OrganizationId == KeycloakTestRealmSeeder.OrgAId);
    }

    // ── OrganizationId in POST body is ignored — org is always from JWT ───────

    [Fact]
    public async Task CreateProject_OrgIdInBodyIsIgnored_ProjectBelongsToCallerOrg()
    {
        var resp = await _adminOrgAClient.PostAsJsonAsync("/api/v1/projects", new
        {
            name = "Org-B Crafted",
            color = "#AABBCC",
            organizationId = KeycloakTestRealmSeeder.OrgBId, // injected — must be ignored
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await resp.Content.ReadFromJsonAsync<ProjectDto>(Jso);
        dto!.OrganizationId.Should().Be(KeycloakTestRealmSeeder.OrgAId);
    }
}
