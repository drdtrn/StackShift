using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackSift.Application.Interfaces;
using StackSift.Domain.Exceptions;
using StackSift.Infrastructure.Configuration;

namespace StackSift.Infrastructure.Identity;

public sealed class KeycloakAdminClient(
    HttpClient http,
    IOptions<KeycloakAdminOptions> opts,
    ILogger<KeycloakAdminClient> logger,
    TimeProvider? time = null)
    : IKeycloakAdminClient
{
    private readonly KeycloakAdminOptions _opts = opts.Value;
    private readonly TimeProvider _time = time ?? TimeProvider.System;
    private readonly SemaphoreSlim _tokenLock = new(1, 1);
    private string? _cachedToken;
    private DateTimeOffset _tokenExpiresAt;

    public async Task<Guid> CreateUserAsync(
        string email, string password, string displayName,
        string stacksiftRole, Guid? organizationId, bool emailVerified, CancellationToken ct)
    {
        var token = await GetServiceAccountTokenAsync(ct);

        var payload = new
        {
            email,
            username = email,
            firstName = displayName,
            enabled = true,
            emailVerified,
            credentials = new[]
            {
                new { type = "password", value = password, temporary = false },
            },
            attributes = BuildAttributes(stacksiftRole, organizationId),
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{_opts.AdminBaseUrl}/users")
        {
            Content = JsonContent.Create(payload),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var resp = await http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Conflict)
            throw new ConflictException($"User with email '{email}' already exists.");
        resp.EnsureSuccessStatusCode();

        var location = resp.Headers.Location?.ToString()
            ?? throw new InvalidOperationException("Keycloak did not return a Location header on user creation.");
        var userId = Guid.Parse(location.Split('/').Last());

        logger.LogInformation("Created Keycloak user {UserId} ({Email})", userId, email);
        return userId;
    }

    public async Task SetUserAttributesAsync(
        Guid keycloakUserId, string stacksiftRole, Guid? organizationId, CancellationToken ct)
    {
        var token = await GetServiceAccountTokenAsync(ct);

        using var getReq = new HttpRequestMessage(
            HttpMethod.Get, $"{_opts.AdminBaseUrl}/users/{keycloakUserId}");
        getReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var getResp = await http.SendAsync(getReq, ct);
        if (getResp.StatusCode == HttpStatusCode.NotFound)
            throw new NotFoundException(nameof(KeycloakUserSummary), keycloakUserId);
        getResp.EnsureSuccessStatusCode();

        var node = await getResp.Content.ReadFromJsonAsync<JsonNode>(ct)
            ?? throw new InvalidOperationException("Empty body from Keycloak user GET.");
        var user = node.AsObject();

        user["attributes"] = JsonSerializer.SerializeToNode(
            BuildAttributes(stacksiftRole, organizationId));

        using var putReq = new HttpRequestMessage(
            HttpMethod.Put, $"{_opts.AdminBaseUrl}/users/{keycloakUserId}")
        {
            Content = new StringContent(user.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        putReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var putResp = await http.SendAsync(putReq, ct);
        putResp.EnsureSuccessStatusCode();

        logger.LogInformation(
            "Updated Keycloak attributes for {UserId}: role={Role}, org={OrgId}",
            keycloakUserId, stacksiftRole, organizationId);
    }

    public async Task DeleteUserAsync(Guid keycloakUserId, CancellationToken ct)
    {
        var token = await GetServiceAccountTokenAsync(ct);

        using var req = new HttpRequestMessage(
            HttpMethod.Delete, $"{_opts.AdminBaseUrl}/users/{keycloakUserId}");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var resp = await http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.NotFound)
            throw new NotFoundException(nameof(KeycloakUserSummary), keycloakUserId);
        resp.EnsureSuccessStatusCode();

        logger.LogInformation("Deleted Keycloak user {UserId}", keycloakUserId);
    }

    public async Task SetUserEnabledAsync(Guid keycloakUserId, bool enabled, CancellationToken ct)
    {
        var token = await GetServiceAccountTokenAsync(ct);

        // Fetch the user representation so we can preserve every field the PUT
        // would otherwise clear. Mirrors SetUserAttributesAsync's pattern.
        using var getReq = new HttpRequestMessage(
            HttpMethod.Get, $"{_opts.AdminBaseUrl}/users/{keycloakUserId}");
        getReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var getResp = await http.SendAsync(getReq, ct);
        if (getResp.StatusCode == HttpStatusCode.NotFound)
            throw new NotFoundException(nameof(KeycloakUserSummary), keycloakUserId);
        getResp.EnsureSuccessStatusCode();

        var node = await getResp.Content.ReadFromJsonAsync<JsonNode>(ct)
            ?? throw new InvalidOperationException("Empty body from Keycloak user GET.");
        var user = node.AsObject();
        user["enabled"] = enabled;

        using var putReq = new HttpRequestMessage(
            HttpMethod.Put, $"{_opts.AdminBaseUrl}/users/{keycloakUserId}")
        {
            Content = new StringContent(user.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        putReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var putResp = await http.SendAsync(putReq, ct);
        putResp.EnsureSuccessStatusCode();

        logger.LogInformation(
            "Set Keycloak user {UserId} enabled={Enabled}", keycloakUserId, enabled);
    }

    public async Task SendVerifyEmailAsync(Guid keycloakUserId, CancellationToken ct)
    {
        var token = await GetServiceAccountTokenAsync(ct);

        using var req = new HttpRequestMessage(
            HttpMethod.Put, $"{_opts.AdminBaseUrl}/users/{keycloakUserId}/send-verify-email");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var resp = await http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.NotFound)
            throw new NotFoundException(nameof(KeycloakUserSummary), keycloakUserId);
        resp.EnsureSuccessStatusCode();

        logger.LogInformation("Sent Keycloak verification email to user {UserId}", keycloakUserId);
    }

    public async Task<KeycloakUserSummary?> FindUserByEmailAsync(string email, CancellationToken ct)
    {
        var token = await GetServiceAccountTokenAsync(ct);

        var encoded = Uri.EscapeDataString(email);
        using var req = new HttpRequestMessage(
            HttpMethod.Get, $"{_opts.AdminBaseUrl}/users?email={encoded}&exact=true");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var resp = await http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();

        var arr = await resp.Content.ReadFromJsonAsync<JsonArray>(ct);
        if (arr is null || arr.Count == 0) return null;

        var user = arr[0]!.AsObject();
        var id = Guid.Parse(user["id"]!.GetValue<string>());
        var resolvedEmail = user["email"]?.GetValue<string>() ?? email;
        var displayName = user["firstName"]?.GetValue<string>() ?? "";

        var attrs = user["attributes"]?.AsObject();
        var role = FirstAttributeValue(attrs, "stacksift_role");
        var orgRaw = FirstAttributeValue(attrs, "organization_id");
        var orgId = Guid.TryParse(orgRaw, out var parsed) ? parsed : (Guid?)null;

        return new KeycloakUserSummary(id, resolvedEmail, displayName, role, orgId);
    }

    private async Task<string> GetServiceAccountTokenAsync(CancellationToken ct)
    {
        if (_cachedToken is not null && _time.GetUtcNow() < _tokenExpiresAt)
            return _cachedToken;

        await _tokenLock.WaitAsync(ct);
        try
        {
            if (_cachedToken is not null && _time.GetUtcNow() < _tokenExpiresAt)
                return _cachedToken;

            var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = _opts.AdminClientId,
                ["client_secret"] = _opts.AdminClientSecret,
            });

            var resp = await http.PostAsync(
                $"{_opts.RealmUrl}/protocol/openid-connect/token", form, ct);
            resp.EnsureSuccessStatusCode();

            var tok = await resp.Content.ReadFromJsonAsync<TokenResponse>(ct)
                ?? throw new InvalidOperationException("Empty token response from Keycloak.");

            _cachedToken = tok.AccessToken;
            _tokenExpiresAt = _time.GetUtcNow().AddSeconds(Math.Max(1, tok.ExpiresIn - 10));
            return _cachedToken;
        }
        finally
        {
            _tokenLock.Release();
        }
    }

    private static Dictionary<string, string[]> BuildAttributes(string role, Guid? organizationId) => new()
    {
        ["stacksift_role"] = [role],
        ["organization_id"] = organizationId is null
            ? []
            : [organizationId.Value.ToString()],
    };

    private static string? FirstAttributeValue(JsonObject? attributes, string key)
    {
        if (attributes is null) return null;
        if (!attributes.TryGetPropertyValue(key, out var node) || node is null) return null;
        if (node is JsonArray arr && arr.Count > 0) return arr[0]?.GetValue<string>();
        return null;
    }

    private sealed record TokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("expires_in")] int ExpiresIn);
}
