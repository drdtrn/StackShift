using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using StackSift.Domain.Exceptions;
using StackSift.Infrastructure.Configuration;
using StackSift.Infrastructure.Identity;

namespace StackSift.Tests.Integration;

[Collection("Integration")]
public class KeycloakAdminClientIntegrationTests(StackSiftWebApplicationFactory factory)
{
    private KeycloakAdminClient BuildClient()
    {
        var http = new HttpClient();
        var opts = Options.Create(new KeycloakAdminOptions
        {
            RealmUrl = $"{factory.KeycloakBaseAddress.TrimEnd('/')}/realms/{KeycloakTestRealmSeeder.RealmName}",
            AdminBaseUrl = $"{factory.KeycloakBaseAddress.TrimEnd('/')}/admin/realms/{KeycloakTestRealmSeeder.RealmName}",
            AdminClientId = KeycloakTestRealmSeeder.AdminServiceAccountClientId,
            AdminClientSecret = factory.KeycloakAdminClientSecret,
        });
        return new KeycloakAdminClient(http, opts, NullLogger<KeycloakAdminClient>.Instance);
    }

    [Fact]
    public async Task CreateThenLogin_RoundTrips()
    {
        var admin = BuildClient();
        var email = $"viewer-{Guid.NewGuid():N}@example.com";

        var userId = await admin.CreateUserAsync(
            email, "Passw0rd!23", "Viewer Vi", "viewer", organizationId: null, default);

        userId.Should().NotBeEmpty();

        var claims = await LoginAndDecodeAsync(email, "Passw0rd!23");
        claims["stacksift_role"]!.GetValue<string>().Should().Be("viewer");
    }

    [Fact]
    public async Task SetAttributes_UpdatesClaims()
    {
        var admin = BuildClient();
        var email = $"mutable-{Guid.NewGuid():N}@example.com";
        var orgId = Guid.NewGuid();

        var userId = await admin.CreateUserAsync(
            email, "Passw0rd!23", "Mut", "viewer", organizationId: null, default);

        await admin.SetUserAttributesAsync(userId, "admin", orgId, default);

        var claims = await LoginAndDecodeAsync(email, "Passw0rd!23");
        claims["stacksift_role"]!.GetValue<string>().Should().Be("admin");
        claims["organization_id"]!.GetValue<string>().Should().Be(orgId.ToString());
    }

    [Fact]
    public async Task Delete_RemovesUser()
    {
        var admin = BuildClient();
        var email = $"doomed-{Guid.NewGuid():N}@example.com";

        var userId = await admin.CreateUserAsync(
            email, "Passw0rd!23", "Doomed", "viewer", organizationId: null, default);

        await admin.DeleteUserAsync(userId, default);

        var status = await TryLoginAsync(email, "Passw0rd!23");
        status.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteUser_OnMissingUser_ThrowsNotFoundException()
    {
        var admin = BuildClient();
        await Assert.ThrowsAsync<NotFoundException>(() =>
            admin.DeleteUserAsync(Guid.NewGuid(), default));
    }

    [Fact]
    public async Task FindUserByEmail_AfterCreate_ReturnsSummary()
    {
        var admin = BuildClient();
        var email = $"findable-{Guid.NewGuid():N}@example.com";
        var orgId = Guid.NewGuid();

        var userId = await admin.CreateUserAsync(
            email, "Passw0rd!23", "Findable", "owner", orgId, default);

        var summary = await admin.FindUserByEmailAsync(email, default);

        summary.Should().NotBeNull();
        summary!.Id.Should().Be(userId);
        summary.Email.Should().Be(email);
        summary.DisplayName.Should().Be("Findable");
        summary.StacksiftRole.Should().Be("owner");
        summary.OrganizationId.Should().Be(orgId);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private async Task<JsonObject> LoginAndDecodeAsync(string email, string password)
    {
        var token = await PostRopcAsync(email, password);
        return DecodeJwtPayload(token);
    }

    private async Task<HttpStatusCode> TryLoginAsync(string email, string password)
    {
        using var http = new HttpClient();
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "password",
            ["client_id"] = KeycloakTestRealmSeeder.TestClientId,
            ["username"] = email,
            ["password"] = password,
        });
        var resp = await http.PostAsync(
            $"{factory.KeycloakBaseAddress.TrimEnd('/')}/realms/{KeycloakTestRealmSeeder.RealmName}/protocol/openid-connect/token",
            form);
        return resp.StatusCode;
    }

    private async Task<string> PostRopcAsync(string email, string password)
    {
        using var http = new HttpClient();
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "password",
            ["client_id"] = KeycloakTestRealmSeeder.TestClientId,
            ["username"] = email,
            ["password"] = password,
        });
        var resp = await http.PostAsync(
            $"{factory.KeycloakBaseAddress.TrimEnd('/')}/realms/{KeycloakTestRealmSeeder.RealmName}/protocol/openid-connect/token",
            form);
        resp.EnsureSuccessStatusCode();
        var body = JsonNode.Parse(await resp.Content.ReadAsStringAsync())!.AsObject();
        return body["access_token"]!.GetValue<string>();
    }

    private static JsonObject DecodeJwtPayload(string jwt)
    {
        var parts = jwt.Split('.');
        if (parts.Length < 2) throw new InvalidOperationException("Malformed JWT.");

        var payload = parts[1];
        var pad = (4 - payload.Length % 4) % 4;
        var b64 = payload.Replace('-', '+').Replace('_', '/') + new string('=', pad);
        var json = Encoding.UTF8.GetString(Convert.FromBase64String(b64));
        return JsonNode.Parse(json)!.AsObject();
    }
}
