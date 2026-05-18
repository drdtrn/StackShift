using System.Collections.Concurrent;
using System.Text.Json;

namespace StackSift.Tests.Integration;

/// <summary>
/// Fetches real access tokens from the Keycloak test container using the
/// Resource Owner Password Credentials grant. Tokens are cached per username
/// for the duration of the test run to avoid unnecessary round-trips.
/// </summary>
public sealed class KeycloakTokenClient(string keycloakBaseAddress, string realm, string clientId)
{
    private readonly string _tokenEndpoint =
        $"{keycloakBaseAddress.TrimEnd('/')}/realms/{realm}/protocol/openid-connect/token";

    private readonly ConcurrentDictionary<string, string> _cache = new();
    private readonly HttpClient _http = new();

    /// <summary>
    /// Returns a cached JWT access token for the given user.
    /// Fetches from Keycloak on the first call per username; subsequent calls return the cached value.
    /// </summary>
    public async Task<string> GetTokenAsync(string username, string password)
    {
        if (_cache.TryGetValue(username, out var cached))
            return cached;

        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "password",
            ["client_id"] = clientId,
            ["username"] = username,
            ["password"] = password,
        });

        var resp = await _http.PostAsync(_tokenEndpoint, form);
        resp.EnsureSuccessStatusCode();

        var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        var token = doc.RootElement.GetProperty("access_token").GetString()!;

        _cache[username] = token;
        return token;
    }
}
