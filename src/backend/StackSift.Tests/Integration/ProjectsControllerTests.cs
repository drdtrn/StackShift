using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using StackSift.Application.DTOs;
using StackSift.Application.Common;
using StackSift.Domain.Entities;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Tests.Integration;

/// <summary>
/// Full CRUD integration tests for /api/v1/projects against a real Postgres container.
/// Each test resets the database via Respawn and uses a real Keycloak-issued JWT.
/// </summary>
[Collection("Integration")]
public class ProjectsControllerTests(StackSiftWebApplicationFactory factory) : IAsyncLifetime
{
    private HttpClient _adminClient = null!;

    private static readonly JsonSerializerOptions Jso = new(JsonSerializerDefaults.Web);

    public async Task InitializeAsync()
    {
        await factory.ResetDatabaseAsync();
        _adminClient = await factory.CreateAuthenticatedClientAsync(
            KeycloakTestRealmSeeder.AdminOrgAEmail,
            KeycloakTestRealmSeeder.AdminOrgAPassword);
    }

    public Task DisposeAsync()
    {
        _adminClient.Dispose();
        return Task.CompletedTask;
    }

    // ── POST create ───────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateProject_ValidInput_Returns201WithLocation()
    {
        var body = new { name = "Alpha Service", description = "First project", color = "#FF5733" };

        var resp = await _adminClient.PostAsJsonAsync("/api/v1/projects", body);

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        resp.Headers.Location.Should().NotBeNull();

        var dto = await resp.Content.ReadFromJsonAsync<ProjectDto>(Jso);
        dto.Should().NotBeNull();
        dto!.Name.Should().Be("Alpha Service");
        dto.Slug.Should().Be("alpha-service");
        dto.OrganizationId.Should().Be(KeycloakTestRealmSeeder.OrgAId);
    }

    // ── GET list (pagination shape) ───────────────────────────────────────────

    [Fact]
    public async Task GetProjects_AfterCreating2_ReturnsPaginatedList()
    {
        await _adminClient.PostAsJsonAsync("/api/v1/projects",
            new { name = "Project One", color = "#111111" });
        await _adminClient.PostAsJsonAsync("/api/v1/projects",
            new { name = "Project Two", color = "#222222" });

        var resp = await _adminClient.GetAsync("/api/v1/projects?page=1&pageSize=10");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var page = await resp.Content.ReadFromJsonAsync<PaginatedResponse<ProjectDto>>(Jso);
        page.Should().NotBeNull();
        page!.Total.Should().BeGreaterThanOrEqualTo(2);
        page.Data.Should().HaveCountGreaterThanOrEqualTo(2);
    }

    // ── GET by ID ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetProjectById_Exists_Returns200()
    {
        var createResp = await _adminClient.PostAsJsonAsync("/api/v1/projects",
            new { name = "Readable Project", color = "#333333" });
        var created = await createResp.Content.ReadFromJsonAsync<ProjectDto>(Jso);

        var resp = await _adminClient.GetAsync($"/api/v1/projects/{created!.Id}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await resp.Content.ReadFromJsonAsync<ProjectDto>(Jso);
        dto!.Id.Should().Be(created.Id);
    }

    // ── PUT update ────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateProject_ValidInput_Returns200WithUpdatedData()
    {
        var createResp = await _adminClient.PostAsJsonAsync("/api/v1/projects",
            new { name = "Old Name", color = "#444444" });
        var created = await createResp.Content.ReadFromJsonAsync<ProjectDto>(Jso);

        var updateBody = new { name = "New Name", description = "Updated", color = "#555555" };
        var resp = await _adminClient.PutAsJsonAsync($"/api/v1/projects/{created!.Id}", updateBody);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await resp.Content.ReadFromJsonAsync<ProjectDto>(Jso);
        updated!.Name.Should().Be("New Name");
        updated.Slug.Should().Be("new-name");
    }

    // ── DELETE → subsequent GET returns 404 ───────────────────────────────────

    [Fact]
    public async Task DeleteProject_Returns204_ThenGetReturns404()
    {
        var createResp = await _adminClient.PostAsJsonAsync("/api/v1/projects",
            new { name = "Doomed Project", color = "#666666" });
        var created = await createResp.Content.ReadFromJsonAsync<ProjectDto>(Jso);

        var deleteResp = await _adminClient.DeleteAsync($"/api/v1/projects/{created!.Id}");
        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var getResp = await _adminClient.GetAsync($"/api/v1/projects/{created.Id}");
        getResp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Duplicate slug → 409 Conflict ────────────────────────────────────────

    [Fact]
    public async Task CreateProject_DuplicateSlug_Returns409()
    {
        await _adminClient.PostAsJsonAsync("/api/v1/projects",
            new { name = "Shared Name", color = "#777777" });

        var resp = await _adminClient.PostAsJsonAsync("/api/v1/projects",
            new { name = "Shared Name", color = "#888888" });

        resp.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }
}
