using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using StackSift.Application.DTOs;

namespace StackSift.Tests.Integration;

/// <summary>
/// Cross-org isolation tests for /api/v1/files/upload.
///
/// The UploadLogFileCommand handler checks project ownership BEFORE calling the
/// file storage service, so the 404 guard fires without needing MinIO reachable.
///
/// Key-prefix guarantee (orgId/projectId/date/guid_filename) is enforced in
/// S3FileStorageService using ICurrentUserService.OrganizationId, not a value
/// from the request body — verified by code audit (see docs/multi-tenancy-verification.md).
/// </summary>
[Collection("Integration")]
public class FilesControllerTests(StackSiftWebApplicationFactory factory) : IAsyncLifetime
{
    private HttpClient _adminOrgAClient = null!;
    private HttpClient _viewerOrgBClient = null!;

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
    }

    public Task DisposeAsync()
    {
        _adminOrgAClient.Dispose();
        _viewerOrgBClient.Dispose();
        return Task.CompletedTask;
    }

    private async Task<Guid> CreateOrgAProjectIdAsync()
    {
        var resp = await _adminOrgAClient.PostAsJsonAsync("/api/v1/projects",
            new { name = "Files Test Project", color = "#ABCDEF" });
        resp.EnsureSuccessStatusCode();
        var dto = (await resp.Content.ReadFromJsonAsync<ProjectDto>(Jso))!;
        return dto.Id;
    }

    private static MultipartFormDataContent BuildUploadForm(Guid projectId)
    {
        var form = new MultipartFormDataContent();
        var fileBytes = "2026-05-19T10:00:00Z INFO test cross-org upload"u8.ToArray();
        var fileContent = new ByteArrayContent(fileBytes);
        fileContent.Headers.ContentType =
            new System.Net.Http.Headers.MediaTypeHeaderValue("text/plain");
        form.Add(fileContent, "file", "test.log");
        form.Add(new StringContent(projectId.ToString()), "projectId");
        return form;
    }

    // ── Cross-tenant upload → 404 before storage is reached ──────────────────

    [Fact]
    public async Task UploadFile_WrongOrg_Returns404()
    {
        var projectId = await CreateOrgAProjectIdAsync();

        using var form = BuildUploadForm(projectId);
        var resp = await _viewerOrgBClient.PostAsync("/api/v1/files/upload", form);

        // UploadLogFileCommand handler verifies project org ownership before
        // calling storage.UploadAsync — MinIO need not be reachable for this guard.
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
