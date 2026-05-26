using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Persistence;
using StackSift.Tests.Helpers;
using Xunit;

namespace StackSift.Tests.Integration;

[Collection("Integration")]
[TestCaseOrderer(
    "StackSift.Tests.Helpers.AlphabeticalTestCaseOrderer",
    "StackSift.Tests")]
public class OrganizationsControllerTests(StackSiftWebApplicationFactory factory) : IAsyncLifetime
{
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private HttpClient _ownerlessClient = null!;
    private HttpClient _ownerClient = null!;
    private HttpClient _adminClient = null!;
    private HttpClient _anonClient = null!;
    private Guid _ownerlessUserId;
    private Guid _ownerUserId;

    private sealed record CreateBody(string Name);
    private sealed record UpdateBody(string Name, string? LogoUrl);
    private sealed record OrgResp(Guid Id, string Name, string Slug, string? LogoUrl, string Plan, DateTimeOffset CreatedAt);

    public async Task InitializeAsync()
    {
        await factory.ResetDatabaseAsync();

        _anonClient = factory.CreateUnauthenticatedClient();
        _ownerlessClient = await factory.CreateAuthenticatedClientAsync(
            KeycloakTestRealmSeeder.OwnerlessEmail, KeycloakTestRealmSeeder.OwnerlessPassword);
        _ownerClient = await factory.CreateAuthenticatedClientAsync(
            KeycloakTestRealmSeeder.OwnerOrgAEmail, KeycloakTestRealmSeeder.OwnerOrgAPassword);
        _adminClient = await factory.CreateAuthenticatedClientAsync(
            KeycloakTestRealmSeeder.AdminOrgAEmail, KeycloakTestRealmSeeder.AdminOrgAPassword);

        _ownerlessUserId = ExtractUserId(await factory.Tokens.GetTokenAsync(
            KeycloakTestRealmSeeder.OwnerlessEmail, KeycloakTestRealmSeeder.OwnerlessPassword));
        _ownerUserId = ExtractUserId(await factory.Tokens.GetTokenAsync(
            KeycloakTestRealmSeeder.OwnerOrgAEmail, KeycloakTestRealmSeeder.OwnerOrgAPassword));

        await SeedAsync();
    }

    public Task DisposeAsync()
    {
        _ownerlessClient.Dispose();
        _ownerClient.Dispose();
        _adminClient.Dispose();
        _anonClient.Dispose();
        return Task.CompletedTask;
    }

    private async Task SeedAsync()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        db.Organizations.Add(new Organization
        {
            Id = KeycloakTestRealmSeeder.OrgAId,
            Name = "Org A",
            Slug = "org-a",
            Plan = Plan.Free,
        });
        db.Organizations.Add(new Organization
        {
            Id = KeycloakTestRealmSeeder.OrgBId,
            Name = "Org B",
            Slug = "org-b",
            Plan = Plan.Indie,
        });
        db.Users.Add(new User
        {
            Id = _ownerUserId,
            Email = KeycloakTestRealmSeeder.OwnerOrgAEmail,
            DisplayName = "Owner OrgA",
            Role = UserRole.Owner,
            OrganizationId = KeycloakTestRealmSeeder.OrgAId,
        });
        db.Users.Add(new User
        {
            Id = _ownerlessUserId,
            Email = KeycloakTestRealmSeeder.OwnerlessEmail,
            DisplayName = "Ownerless",
            Role = UserRole.Viewer,
            OrganizationId = null,
        });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Post_Org_AsAuthenticatedUserWithoutOrg_Returns201()
    {
        var resp = await _ownerlessClient.PostAsJsonAsync(
            "/api/v1/organizations", new CreateBody($"Brand New {Guid.NewGuid():N}"), Json);

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<OrgResp>(Json);
        body.Should().NotBeNull();
        body!.Id.Should().NotBeEmpty();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var dbOrg = await db.Organizations.SingleAsync(o => o.Id == body.Id);
        dbOrg.Slug.Should().Be(body.Slug);

        var dbUser = await db.Users.SingleAsync(u => u.Id == _ownerlessUserId);
        dbUser.OrganizationId.Should().Be(body.Id);
        dbUser.Role.Should().Be(UserRole.Owner);
    }

    [Fact]
    public async Task Post_Org_AsUserWithExistingOrg_Returns409()
    {
        var resp = await _ownerClient.PostAsJsonAsync(
            "/api/v1/organizations", new CreateBody("Second Org"), Json);
        resp.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Post_Org_Unauthenticated_Returns401()
    {
        var resp = await _anonClient.PostAsJsonAsync(
            "/api/v1/organizations", new CreateBody("Anon Org"), Json);
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Post_Org_DuplicateSlug_Returns409()
    {
        var resp = await _ownerlessClient.PostAsJsonAsync(
            "/api/v1/organizations", new CreateBody("Org A"), Json);
        resp.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Post_Org_InvalidName_Returns400()
    {
        var resp = await _ownerlessClient.PostAsJsonAsync(
            "/api/v1/organizations", new CreateBody("<script>alert(1)</script>"), Json);
        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Get_Current_AsOwner_ReturnsOwnOrg()
    {
        var resp = await _ownerClient.GetAsync("/api/v1/organizations/current");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<OrgResp>(Json);
        body.Should().NotBeNull();
        body!.Id.Should().Be(KeycloakTestRealmSeeder.OrgAId);
        body.Name.Should().Be("Org A");
        body.Plan.Should().Be("free");
    }

    [Fact]
    public async Task Put_Org_AsOwner_UpdatesOrg()
    {
        var resp = await _ownerClient.PutAsJsonAsync(
            $"/api/v1/organizations/{KeycloakTestRealmSeeder.OrgAId}",
            new UpdateBody("Renamed Org", "https://example.com/logo.png"),
            Json);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<OrgResp>(Json);
        body.Should().NotBeNull();
        body!.Name.Should().Be("Renamed Org");
        body.LogoUrl.Should().Be("https://example.com/logo.png");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var org = await db.Organizations.SingleAsync(o => o.Id == KeycloakTestRealmSeeder.OrgAId);
        org.Name.Should().Be("Renamed Org");
        org.LogoUrl.Should().Be("https://example.com/logo.png");
    }

    [Fact]
    public async Task Put_Org_CrossOrg_Returns404()
    {
        var resp = await _ownerClient.PutAsJsonAsync(
            $"/api/v1/organizations/{KeycloakTestRealmSeeder.OrgBId}",
            new UpdateBody("Bad Rename", null),
            Json);

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Put_Org_AsNonOwner_Returns403()
    {
        var resp = await _adminClient.PutAsJsonAsync(
            $"/api/v1/organizations/{KeycloakTestRealmSeeder.OrgAId}",
            new UpdateBody("Admin Rename", null),
            Json);

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    private static Guid ExtractUserId(string jwt)
    {
        var parts = jwt.Split('.');
        var payload = parts[1];
        var pad = (4 - payload.Length % 4) % 4;
        var b64 = payload.Replace('-', '+').Replace('_', '/') + new string('=', pad);
        var json = Encoding.UTF8.GetString(Convert.FromBase64String(b64));
        var claims = JsonNode.Parse(json)!.AsObject();
        return Guid.Parse(claims["sub"]!.GetValue<string>());
    }
}
