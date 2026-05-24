using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using StackSift.Application.Interfaces;
using StackSift.Domain.Exceptions;
using StackSift.Infrastructure.Configuration;
using StackSift.Infrastructure.Identity;

namespace StackSift.Tests.Infrastructure.Identity;

public class KeycloakAdminClientTests
{
    private const string RealmUrl = "https://kc.test/realms/stacksift";
    private const string AdminBaseUrl = "https://kc.test/admin/realms/stacksift";
    private const string AdminClientId = "stacksift-backend-admin";
    private const string AdminClientSecret = "test-secret";

    private static KeycloakAdminOptions Opts() => new()
    {
        RealmUrl = RealmUrl,
        AdminBaseUrl = AdminBaseUrl,
        AdminClientId = AdminClientId,
        AdminClientSecret = AdminClientSecret,
    };

    private static KeycloakAdminClient Build(StubHandler handler, TimeProvider? time = null)
    {
        var http = new HttpClient(handler);
        return new KeycloakAdminClient(
            http,
            Options.Create(Opts()),
            NullLogger<KeycloakAdminClient>.Instance,
            time);
    }

    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateUser_PostsCorrectPayload()
    {
        var handler = new StubHandler();
        handler.OnToken();
        var newUserId = Guid.NewGuid();
        handler.OnUserCreated(newUserId);

        var client = Build(handler);
        var id = await client.CreateUserAsync(
            email: "alice@example.com",
            password: "s3cret-pw-123",
            displayName: "Alice",
            stacksiftRole: "owner",
            organizationId: null,
            ct: default);

        Assert.Equal(newUserId, id);

        var post = handler.RequestsTo($"{AdminBaseUrl}/users").Single(r => r.Method == HttpMethod.Post);
        Assert.Equal("Bearer", post.AuthScheme);
        Assert.Equal("fake-access-token", post.AuthParameter);

        var body = JsonNode.Parse(post.Body!)!.AsObject();
        Assert.Equal("alice@example.com", body["email"]!.GetValue<string>());
        Assert.Equal("alice@example.com", body["username"]!.GetValue<string>());
        Assert.Equal("Alice", body["firstName"]!.GetValue<string>());
        Assert.True(body["enabled"]!.GetValue<bool>());

        var creds = body["credentials"]!.AsArray();
        Assert.Single(creds);
        Assert.Equal("password", creds[0]!["type"]!.GetValue<string>());
        Assert.Equal("s3cret-pw-123", creds[0]!["value"]!.GetValue<string>());

        var attrs = body["attributes"]!.AsObject();
        Assert.Equal("owner", attrs["stacksift_role"]!.AsArray()[0]!.GetValue<string>());
        Assert.Empty(attrs["organization_id"]!.AsArray());
    }

    [Fact]
    public async Task CreateUser_WithOrganizationId_SerializesAsSingleElementArray()
    {
        var handler = new StubHandler();
        handler.OnToken();
        var newUserId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        handler.OnUserCreated(newUserId);

        var client = Build(handler);
        await client.CreateUserAsync("bob@example.com", "pw", "Bob", "viewer", orgId, default);

        var post = handler.RequestsTo($"{AdminBaseUrl}/users").Single(r => r.Method == HttpMethod.Post);
        var attrs = JsonNode.Parse(post.Body!)!["attributes"]!.AsObject();
        var orgArr = attrs["organization_id"]!.AsArray();
        Assert.Single(orgArr);
        Assert.Equal(orgId.ToString(), orgArr[0]!.GetValue<string>());
    }

    [Fact]
    public async Task CreateUser_OnConflict_ThrowsConflictException()
    {
        var handler = new StubHandler();
        handler.OnToken();
        handler.OnAdminUsersPostStatus(HttpStatusCode.Conflict);

        var client = Build(handler);
        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            client.CreateUserAsync("dup@example.com", "pw", "Dup", "viewer", null, default));
        Assert.Contains("dup@example.com", ex.Message);
    }

    [Fact]
    public async Task SetAttributes_GetsThenPutsWithMergedRepresentation()
    {
        var userId = Guid.NewGuid();
        var orgId = Guid.NewGuid();

        var handler = new StubHandler();
        handler.OnToken();
        handler.OnUserGet(userId, JsonSerializer.Serialize(new
        {
            id = userId,
            username = "alice@example.com",
            email = "alice@example.com",
            firstName = "Alice",
            enabled = true,
            attributes = new Dictionary<string, string[]>
            {
                ["stacksift_role"] = ["viewer"],
                ["organization_id"] = [],
            },
        }));
        handler.OnUserPut(userId);

        var client = Build(handler);
        await client.SetUserAttributesAsync(userId, "admin", orgId, default);

        var put = handler.RequestsTo($"{AdminBaseUrl}/users/{userId}").Single(r => r.Method == HttpMethod.Put);
        var body = JsonNode.Parse(put.Body!)!.AsObject();

        Assert.Equal("alice@example.com", body["email"]!.GetValue<string>());
        Assert.Equal("Alice", body["firstName"]!.GetValue<string>());

        var attrs = body["attributes"]!.AsObject();
        Assert.Equal("admin", attrs["stacksift_role"]!.AsArray()[0]!.GetValue<string>());
        Assert.Equal(orgId.ToString(), attrs["organization_id"]!.AsArray()[0]!.GetValue<string>());
    }

    [Fact]
    public async Task SetAttributes_OnMissingUser_ThrowsNotFoundException()
    {
        var userId = Guid.NewGuid();
        var handler = new StubHandler();
        handler.OnToken();
        handler.OnUserGetStatus(userId, HttpStatusCode.NotFound);

        var client = Build(handler);
        await Assert.ThrowsAsync<NotFoundException>(() =>
            client.SetUserAttributesAsync(userId, "admin", null, default));
    }

    [Fact]
    public async Task TokenCache_CoalescesConcurrentCalls()
    {
        var handler = new StubHandler();
        handler.OnToken();
        handler.OnUserCreatedAny();

        var client = Build(handler);

        var tasks = Enumerable.Range(0, 1000)
            .Select(i => client.CreateUserAsync(
                $"u{i}@example.com", "pw", $"U{i}", "viewer", null, default))
            .ToArray();
        await Task.WhenAll(tasks);

        Assert.Equal(1, handler.TokenRequestCount);
    }

    [Fact]
    public async Task TokenCache_RefreshesAfterExpiry()
    {
        var handler = new StubHandler();
        handler.OnToken(expiresInSeconds: 60);
        handler.OnUserCreatedAny();

        var time = new MutableTimeProvider(DateTimeOffset.UtcNow);
        var client = Build(handler, time);

        await client.CreateUserAsync("a@example.com", "pw", "A", "viewer", null, default);
        Assert.Equal(1, handler.TokenRequestCount);

        time.Advance(TimeSpan.FromSeconds(120));

        await client.CreateUserAsync("b@example.com", "pw", "B", "viewer", null, default);
        Assert.Equal(2, handler.TokenRequestCount);
    }

    [Fact]
    public async Task DeleteUser_Success_HitsCorrectEndpoint()
    {
        var userId = Guid.NewGuid();
        var handler = new StubHandler();
        handler.OnToken();
        handler.OnUserDelete(userId, HttpStatusCode.NoContent);

        var client = Build(handler);
        await client.DeleteUserAsync(userId, default);

        var del = handler.RequestsTo($"{AdminBaseUrl}/users/{userId}").Single(r => r.Method == HttpMethod.Delete);
        Assert.Equal("Bearer", del.AuthScheme);
    }

    [Fact]
    public async Task DeleteUser_OnMissingUser_ThrowsNotFoundException()
    {
        var userId = Guid.NewGuid();
        var handler = new StubHandler();
        handler.OnToken();
        handler.OnUserDelete(userId, HttpStatusCode.NotFound);

        var client = Build(handler);
        await Assert.ThrowsAsync<NotFoundException>(() =>
            client.DeleteUserAsync(userId, default));
    }

    [Fact]
    public async Task FindUserByEmail_NotFound_ReturnsNull()
    {
        var handler = new StubHandler();
        handler.OnToken();
        handler.OnUserSearch("missing@example.com", body: "[]");

        var client = Build(handler);
        var result = await client.FindUserByEmailAsync("missing@example.com", default);

        Assert.Null(result);
    }

    [Fact]
    public async Task FindUserByEmail_Found_ReturnsParsedSummary()
    {
        var userId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var body = JsonSerializer.Serialize(new[]
        {
            new
            {
                id = userId,
                email = "found@example.com",
                firstName = "Found",
                attributes = new Dictionary<string, string[]>
                {
                    ["stacksift_role"] = ["admin"],
                    ["organization_id"] = [orgId.ToString()],
                },
            },
        });

        var handler = new StubHandler();
        handler.OnToken();
        handler.OnUserSearch("found@example.com", body);

        var client = Build(handler);
        var summary = await client.FindUserByEmailAsync("found@example.com", default);

        Assert.NotNull(summary);
        Assert.Equal(userId, summary!.Id);
        Assert.Equal("found@example.com", summary.Email);
        Assert.Equal("Found", summary.DisplayName);
        Assert.Equal("admin", summary.StacksiftRole);
        Assert.Equal(orgId, summary.OrganizationId);
    }

    [Fact]
    public async Task FindUserByEmail_RequestUsesExactQueryParam()
    {
        var handler = new StubHandler();
        handler.OnToken();
        handler.OnUserSearch("probe@example.com", body: "[]");

        var client = Build(handler);
        await client.FindUserByEmailAsync("probe@example.com", default);

        var searchPath = $"{AdminBaseUrl}/users";
        var search = handler.AllRequests.Single(r =>
            r.Method == HttpMethod.Get &&
            r.Url.GetLeftPart(UriPartial.Path) == searchPath);

        Assert.Contains("email=probe%40example.com", search.Url.Query);
        Assert.Contains("exact=true", search.Url.Query);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private sealed class MutableTimeProvider(DateTimeOffset start) : TimeProvider
    {
        private DateTimeOffset _now = start;
        public override DateTimeOffset GetUtcNow() => _now;
        public void Advance(TimeSpan span) => _now = _now.Add(span);
    }

    private sealed record CapturedRequest(
        HttpMethod Method,
        Uri Url,
        string? Body,
        string? AuthScheme,
        string? AuthParameter);

    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly List<Func<HttpRequestMessage, HttpResponseMessage?>> _responders = [];
        private readonly List<CapturedRequest> _requests = [];
        private int _tokenRequestCount;

        public int TokenRequestCount => _tokenRequestCount;
        public IReadOnlyList<CapturedRequest> AllRequests => _requests;

        public IEnumerable<CapturedRequest> RequestsTo(string url) =>
            _requests.Where(r => r.Url.GetLeftPart(UriPartial.Path) == url);

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            string? body = null;
            if (request.Content is not null)
                body = await request.Content.ReadAsStringAsync(cancellationToken);

            _requests.Add(new CapturedRequest(
                request.Method,
                request.RequestUri!,
                body,
                request.Headers.Authorization?.Scheme,
                request.Headers.Authorization?.Parameter));

            foreach (var responder in _responders)
            {
                var resp = responder(request);
                if (resp is not null) return resp;
            }

            throw new InvalidOperationException(
                $"No stub responder matched {request.Method} {request.RequestUri}");
        }

        public void OnToken(int expiresInSeconds = 60)
        {
            var tokenUrl = $"{RealmUrl}/protocol/openid-connect/token";
            _responders.Add(req =>
            {
                if (req.Method == HttpMethod.Post && req.RequestUri?.ToString() == tokenUrl)
                {
                    Interlocked.Increment(ref _tokenRequestCount);
                    var payload = JsonSerializer.Serialize(new
                    {
                        access_token = "fake-access-token",
                        expires_in = expiresInSeconds,
                    });
                    return new HttpResponseMessage(HttpStatusCode.OK)
                    {
                        Content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json"),
                    };
                }
                return null;
            });
        }

        public void OnUserCreated(Guid newUserId)
        {
            _responders.Add(req =>
            {
                if (req.Method == HttpMethod.Post && req.RequestUri?.ToString() == $"{AdminBaseUrl}/users")
                {
                    var resp = new HttpResponseMessage(HttpStatusCode.Created);
                    resp.Headers.Location = new Uri($"{AdminBaseUrl}/users/{newUserId}");
                    return resp;
                }
                return null;
            });
        }

        public void OnUserCreatedAny()
        {
            _responders.Add(req =>
            {
                if (req.Method == HttpMethod.Post && req.RequestUri?.ToString() == $"{AdminBaseUrl}/users")
                {
                    var resp = new HttpResponseMessage(HttpStatusCode.Created);
                    resp.Headers.Location = new Uri($"{AdminBaseUrl}/users/{Guid.NewGuid()}");
                    return resp;
                }
                return null;
            });
        }

        public void OnAdminUsersPostStatus(HttpStatusCode status)
        {
            _responders.Add(req =>
            {
                if (req.Method == HttpMethod.Post && req.RequestUri?.ToString() == $"{AdminBaseUrl}/users")
                    return new HttpResponseMessage(status);
                return null;
            });
        }

        public void OnUserGet(Guid userId, string body)
        {
            _responders.Add(req =>
            {
                if (req.Method == HttpMethod.Get && req.RequestUri?.ToString() == $"{AdminBaseUrl}/users/{userId}")
                    return new HttpResponseMessage(HttpStatusCode.OK)
                    {
                        Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json"),
                    };
                return null;
            });
        }

        public void OnUserGetStatus(Guid userId, HttpStatusCode status)
        {
            _responders.Add(req =>
            {
                if (req.Method == HttpMethod.Get && req.RequestUri?.ToString() == $"{AdminBaseUrl}/users/{userId}")
                    return new HttpResponseMessage(status);
                return null;
            });
        }

        public void OnUserPut(Guid userId)
        {
            _responders.Add(req =>
            {
                if (req.Method == HttpMethod.Put && req.RequestUri?.ToString() == $"{AdminBaseUrl}/users/{userId}")
                    return new HttpResponseMessage(HttpStatusCode.NoContent);
                return null;
            });
        }

        public void OnUserDelete(Guid userId, HttpStatusCode status)
        {
            _responders.Add(req =>
            {
                if (req.Method == HttpMethod.Delete && req.RequestUri?.ToString() == $"{AdminBaseUrl}/users/{userId}")
                    return new HttpResponseMessage(status);
                return null;
            });
        }

        public void OnUserSearch(string email, string body)
        {
            _responders.Add(req =>
            {
                if (req.Method != HttpMethod.Get) return null;
                if (req.RequestUri is null) return null;
                if (req.RequestUri.GetLeftPart(UriPartial.Path) != $"{AdminBaseUrl}/users") return null;
                if (!req.RequestUri.Query.Contains($"email={Uri.EscapeDataString(email)}")) return null;

                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json"),
                };
            });
        }
    }
}
