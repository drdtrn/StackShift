using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace StackSift.Tests.Integration;

/// <summary>
/// Configures the Keycloak container for integration tests using the Admin REST API.
/// Called once after the Keycloak container has started.
/// </summary>
public static class KeycloakTestRealmSeeder
{
    public const string RealmName = "stacksift";
    public const string TestClientId = "stacksift-api-test";
    public const string ResourceServer = "stacksift-api";

    /// <summary>Org-A user (admin role) — used in auth + CRUD tests.</summary>
    public const string AdminOrgAEmail = "admin@org-a.test";
    public const string AdminOrgAPassword = "admin-pass-a";

    /// <summary>Org-B user (viewer role) — used in cross-tenant tests.</summary>
    public const string ViewerOrgBEmail = "viewer@org-b.test";
    public const string ViewerOrgBPassword = "viewer-pass-b";

    // Fixed UUIDs so tests can seed DB data for a known org and reference it
    public static readonly Guid OrgAId = new("aaaaaaaa-0000-0000-0000-000000000001");
    public static readonly Guid OrgBId = new("bbbbbbbb-0000-0000-0000-000000000002");

    private static readonly JsonSerializerOptions Jso = new() { WriteIndented = false };

    public static async Task SeedAsync(string keycloakBaseAddress)
    {
        using var http = new HttpClient { BaseAddress = new Uri(keycloakBaseAddress) };

        // 1. Get master-realm admin token
        var adminToken = await GetAdminTokenAsync(http);
        http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", adminToken);

        // 2. Create realm
        await CreateRealmAsync(http);

        // 3. Create the resource-server client (bearer-only, needed for audience)
        await CreateClientAsync(http, new
        {
            clientId = ResourceServer,
            protocol = "openid-connect",
            bearerOnly = true,
            enabled = true,
            publicClient = false,
        });

        // 4. Create the test client (public, password grant)
        await CreateClientAsync(http, new
        {
            clientId = TestClientId,
            protocol = "openid-connect",
            publicClient = true,
            directAccessGrantsEnabled = true,
            enabled = true,
        });

        // 5. Get the test client's UUID so we can attach mappers
        var clientUuid = await GetClientUuidAsync(http, TestClientId);

        // 6. Audience mapper → adds "stacksift-api" to the aud claim
        await AddProtocolMapperAsync(http, clientUuid, new
        {
            name = "stacksift-api-audience",
            protocol = "openid-connect",
            protocolMapper = "oidc-audience-mapper",
            consentRequired = false,
            config = new Dictionary<string, string>
            {
                ["included.client.audience"] = ResourceServer,
                ["access.token.claim"] = "true",
                ["id.token.claim"] = "false",
            },
        });

        // 7. Attribute mapper for organization_id
        await AddProtocolMapperAsync(http, clientUuid, new
        {
            name = "organization-id-mapper",
            protocol = "openid-connect",
            protocolMapper = "oidc-usermodel-attribute-mapper",
            consentRequired = false,
            config = new Dictionary<string, string>
            {
                ["user.attribute"] = "organization_id",
                ["claim.name"] = "organization_id",
                ["jsonType.label"] = "String",
                ["access.token.claim"] = "true",
                ["id.token.claim"] = "false",
                ["userinfo.token.claim"] = "false",
            },
        });

        // 8. Attribute mapper for stacksift_role
        await AddProtocolMapperAsync(http, clientUuid, new
        {
            name = "stacksift-role-mapper",
            protocol = "openid-connect",
            protocolMapper = "oidc-usermodel-attribute-mapper",
            consentRequired = false,
            config = new Dictionary<string, string>
            {
                ["user.attribute"] = "stacksift_role",
                ["claim.name"] = "stacksift_role",
                ["jsonType.label"] = "String",
                ["access.token.claim"] = "true",
                ["id.token.claim"] = "false",
                ["userinfo.token.claim"] = "false",
            },
        });

        // 9. Create test users
        await CreateUserAsync(http, AdminOrgAEmail, AdminOrgAPassword,
            orgId: OrgAId, role: "admin");

        await CreateUserAsync(http, ViewerOrgBEmail, ViewerOrgBPassword,
            orgId: OrgBId, role: "viewer");
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private static async Task<string> GetAdminTokenAsync(HttpClient http)
    {
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "password",
            ["client_id"] = "admin-cli",
            ["username"] = "admin",
            ["password"] = "admin",
        });

        var resp = await http.PostAsync("/realms/master/protocol/openid-connect/token", form);
        resp.EnsureSuccessStatusCode();

        var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("access_token").GetString()!;
    }

    private static async Task CreateRealmAsync(HttpClient http)
    {
        var payload = JsonSerializer.Serialize(new
        {
            realm = RealmName,
            enabled = true,
            accessTokenLifespan = 3600,
        }, Jso);

        var resp = await http.PostAsync("/admin/realms",
            new StringContent(payload, Encoding.UTF8, "application/json"));

        // 201 = created, 409 = already exists (idempotent)
        if (resp.StatusCode != System.Net.HttpStatusCode.Conflict)
            resp.EnsureSuccessStatusCode();
    }

    private static async Task CreateClientAsync(HttpClient http, object clientDef)
    {
        var payload = JsonSerializer.Serialize(clientDef, Jso);
        var resp = await http.PostAsync($"/admin/realms/{RealmName}/clients",
            new StringContent(payload, Encoding.UTF8, "application/json"));

        if (resp.StatusCode != System.Net.HttpStatusCode.Conflict)
            resp.EnsureSuccessStatusCode();
    }

    private static async Task<string> GetClientUuidAsync(HttpClient http, string clientId)
    {
        var resp = await http.GetAsync($"/admin/realms/{RealmName}/clients?clientId={clientId}");
        resp.EnsureSuccessStatusCode();

        var arr = JsonNode.Parse(await resp.Content.ReadAsStringAsync())!.AsArray();
        return arr[0]!["id"]!.GetValue<string>();
    }

    private static async Task AddProtocolMapperAsync(HttpClient http, string clientUuid, object mapperDef)
    {
        var payload = JsonSerializer.Serialize(mapperDef, Jso);
        var resp = await http.PostAsync(
            $"/admin/realms/{RealmName}/clients/{clientUuid}/protocol-mappers/models",
            new StringContent(payload, Encoding.UTF8, "application/json"));

        if (resp.StatusCode != System.Net.HttpStatusCode.Conflict)
            resp.EnsureSuccessStatusCode();
    }

    private static async Task CreateUserAsync(HttpClient http, string email, string password,
        Guid orgId, string role)
    {
        var payload = JsonSerializer.Serialize(new
        {
            username = email,
            email,
            enabled = true,
            emailVerified = true,
            attributes = new Dictionary<string, string[]>
            {
                ["organization_id"] = [orgId.ToString()],
                ["stacksift_role"] = [role],
            },
            credentials = new[]
            {
                new { type = "password", value = password, temporary = false },
            },
        }, Jso);

        var resp = await http.PostAsync($"/admin/realms/{RealmName}/users",
            new StringContent(payload, Encoding.UTF8, "application/json"));

        if (resp.StatusCode != System.Net.HttpStatusCode.Conflict)
            resp.EnsureSuccessStatusCode();
    }
}
