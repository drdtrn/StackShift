using System.Net;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Persistence;
using StackSift.Tests.Helpers;

namespace StackSift.Tests.Integration;

/// <summary>
/// End-to-end authentication and authorisation tests.
/// Verifies the full Keycloak → JWT → policy pipeline with real tokens.
/// </summary>
[Collection("Integration")]
public class AuthIntegrationTests(StackSiftWebApplicationFactory factory) : IAsyncLifetime
{
    private HttpClient _anonClient = null!;
    private HttpClient _adminOrgAClient = null!;
    private HttpClient _viewerOrgBClient = null!;
    private HttpClient _unverifiedOrgAClient = null!;

    public async Task InitializeAsync()
    {
        await factory.ResetDatabaseAsync();
        _anonClient = factory.CreateUnauthenticatedClient();
        _adminOrgAClient = await factory.CreateAuthenticatedClientAsync(
            KeycloakTestRealmSeeder.AdminOrgAEmail,
            KeycloakTestRealmSeeder.AdminOrgAPassword);
        _viewerOrgBClient = await factory.CreateAuthenticatedClientAsync(
            KeycloakTestRealmSeeder.ViewerOrgBEmail,
            KeycloakTestRealmSeeder.ViewerOrgBPassword);
        _unverifiedOrgAClient = await factory.CreateAuthenticatedClientAsync(
            KeycloakTestRealmSeeder.UnverifiedEmail,
            KeycloakTestRealmSeeder.UnverifiedPassword);
    }

    public Task DisposeAsync()
    {
        _anonClient.Dispose();
        _adminOrgAClient.Dispose();
        _viewerOrgBClient.Dispose();
        _unverifiedOrgAClient.Dispose();
        return Task.CompletedTask;
    }

    // ── 401 cases ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetProjects_NoToken_Returns401()
    {
        var resp = await _anonClient.GetAsync("/api/v1/projects");
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetProjects_TamperedToken_Returns401()
    {
        var client = factory.CreateUnauthenticatedClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "not.a.real.jwt");

        var resp = await client.GetAsync("/api/v1/projects");
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetProjects_UnverifiedEmail_Returns403()
    {
        var resp = await _unverifiedOrgAClient.GetAsync("/api/v1/projects");
        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── 200 with valid token ──────────────────────────────────────────────────

    [Fact]
    public async Task GetProjects_ValidAdminToken_Returns200()
    {
        var resp = await _adminOrgAClient.GetAsync("/api/v1/projects");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ── 403 policy enforcement ────────────────────────────────────────────────

    [Fact]
    public async Task DeleteProject_ViewerToken_Returns403()
    {
        // Seed a project owned by org-a
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var projectId = Guid.NewGuid();
        db.Projects.Add(new Project
        {
            Id = projectId,
            OrganizationId = KeycloakTestRealmSeeder.OrgAId,
            Name = "Victim Project",
            Slug = "victim-project",
            Color = "#FF0000",
        });
        await db.SaveChangesAsync();

        // viewer@org-b should be 403 (wrong policy, not wrong org)
        var resp = await _viewerOrgBClient.DeleteAsync($"/api/v1/projects/{projectId}");
        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── 404 cross-tenant masking ──────────────────────────────────────────────

    [Fact]
    public async Task GetProject_WrongOrg_Returns404()
    {
        // Seed a project owned by org-a
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var projectId = Guid.NewGuid();
        db.Projects.Add(new Project
        {
            Id = projectId,
            OrganizationId = KeycloakTestRealmSeeder.OrgAId,
            Name = "Org-A Project",
            Slug = "org-a-project",
            Color = "#0000FF",
        });
        await db.SaveChangesAsync();

        // viewer@org-b sees 404 — cross-tenant resource is masked, not exposed as 403
        var resp = await _viewerOrgBClient.GetAsync($"/api/v1/projects/{projectId}");
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Health check (public endpoint) ───────────────────────────────────────

    [Fact]
    public async Task GetHealth_NoToken_Returns200()
    {
        var resp = await _anonClient.GetAsync("/api/v1/health");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
