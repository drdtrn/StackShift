using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Npgsql;
using Respawn;
using Respawn.Graph;
using StackSift.Application.Interfaces;
using StackSift.Infrastructure.Persistence;
using StackSift.Tests.Helpers;
using Testcontainers.Keycloak;
using Testcontainers.PostgreSql;
using Testcontainers.Redis;

namespace StackSift.Tests.Integration;

/// <summary>
/// xUnit collection definition — all integration test classes share one factory instance.
/// Containers start once per test run (not per class) to amortise the 30–60s startup cost.
/// Per-test isolation is achieved via ResetDatabaseAsync() which uses Respawn (~50ms).
/// </summary>
[CollectionDefinition("Integration")]
public class IntegrationCollection : ICollectionFixture<StackSiftWebApplicationFactory> { }

/// <summary>
/// WebApplicationFactory that boots the full StackSift API against Testcontainers-provisioned
/// Postgres (pgvector:pg16) and Keycloak. MassTransit and Hangfire server are disabled so
/// RabbitMQ is not required. Redis is pointed at a non-existent port with abortConnect=false
/// so the app starts without a real Redis.
/// </summary>
public sealed class StackSiftWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    // Containers are created in InitializeAsync, not the constructor, because container
    // startup is async; ConfigureWebHost is called lazily when the host is first accessed.
    private PostgreSqlContainer _postgres = null!;
    private KeycloakContainer _keycloak = null!;
    private RedisContainer _redis = null!;
    private Respawner _respawner = null!;

    /// <summary>Real Keycloak token client — use in tests to obtain JWTs.</summary>
    public KeycloakTokenClient Tokens { get; private set; } = null!;

    // ── IAsyncLifetime ────────────────────────────────────────────────────────

    async Task IAsyncLifetime.InitializeAsync()
    {
        _postgres = new PostgreSqlBuilder()
            .WithImage("pgvector/pgvector:pg16")
            .Build();

        _keycloak = new KeycloakBuilder()
            .Build();

        _redis = new RedisBuilder().Build();

        // Start all three containers concurrently to minimise cold-start time.
        await Task.WhenAll(_postgres.StartAsync(), _keycloak.StartAsync(), _redis.StartAsync());

        // Seed the Keycloak test realm (realm, client, mappers, two test users).
        await KeycloakTestRealmSeeder.SeedAsync(_keycloak.GetBaseAddress());

        // Run EF Core migrations directly so Respawn can be initialised before
        // the first test hits the host (avoids a race with the lazy host build).
        await MigrateDirectlyAsync();

        // Warm up the test server (triggers ConfigureWebHost + Program.cs startup code).
        // Accessing Server builds the host; migrations from Program.cs are idempotent.
        _ = Server;

        // Wire up Respawn for fast per-test row deletion.
        await InitRespawnerAsync();

        Tokens = new KeycloakTokenClient(
            _keycloak.GetBaseAddress(),
            KeycloakTestRealmSeeder.RealmName,
            KeycloakTestRealmSeeder.TestClientId);
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        // Dispose the WebApplicationFactory (tears down the TestServer / host).
        Dispose();
        if (_postgres is not null) await _postgres.DisposeAsync();
        if (_keycloak is not null) await _keycloak.DisposeAsync();
        if (_redis is not null) await _redis.DisposeAsync();
    }

    // ── WebApplicationFactory overrides ──────────────────────────────────────

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Override configuration BEFORE services are built so Keycloak auth middleware
        // and EF Core pick up the container addresses.
        builder.ConfigureAppConfiguration((_, cfg) =>
        {
            cfg.AddInMemoryCollection(new Dictionary<string, string?>
            {
                // Real Postgres container
                ["ConnectionStrings:DefaultConnection"] = _postgres.GetConnectionString(),

                // Real Keycloak container
                ["Keycloak:AuthServerUrl"] = _keycloak.GetBaseAddress(),
                ["Keycloak:Realm"] = KeycloakTestRealmSeeder.RealmName,
                ["Keycloak:Resource"] = KeycloakTestRealmSeeder.ResourceServer,
                ["Keycloak:VerifyTokenAudience"] = "true",
                ["Keycloak:RequireHttpsMetadata"] = "false",

                // Real Redis container — needed because ConnectionMultiplexer.Connect()
                // is called eagerly at DI registration time and abortConnect=false
                // config overrides don't land in time to prevent the throw.
                ["Redis:ConnectionString"] = _redis.GetConnectionString(),

                // Disable Loki sink (no Loki container in tests)
                ["Serilog:Loki:Url"] = "",
            });
        });

        builder.ConfigureTestServices(services =>
        {
            // ── MassTransit: remove the bus hosted service so RabbitMQ is not required ──
            RemoveHostedServices(services, "MassTransit");

            // Replace IMessagePublisher with a silent no-op (bus not running).
            ReplaceService<IMessagePublisher>(services,
                ServiceDescriptor.Scoped<IMessagePublisher, NoOpMessagePublisher>());

            // ── Hangfire: remove the background processing server ──
            // Storage is still initialised (same Postgres) so IRecurringJobManager works.
            RemoveHostedServices(services, "Hangfire");
        });
    }

    // ── Public test helpers ───────────────────────────────────────────────────

    /// <summary>
    /// Clears all application rows from the test database via Respawn (~50ms).
    /// Call this in IAsyncLifetime.InitializeAsync of each integration test class.
    /// </summary>
    public async Task ResetDatabaseAsync()
    {
        await using var conn = new NpgsqlConnection(_postgres.GetConnectionString());
        await conn.OpenAsync();
        await _respawner.ResetAsync(conn);
    }

    /// <summary>
    /// Creates an HttpClient that does NOT follow redirects (useful for asserting 3xx).
    /// </summary>
    public HttpClient CreateUnauthenticatedClient()
        => CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    /// <summary>
    /// Creates an HttpClient pre-authenticated with a Bearer token for the given user.
    /// </summary>
    public async Task<HttpClient> CreateAuthenticatedClientAsync(string username, string password)
    {
        var token = await Tokens.GetTokenAsync(username, password);
        var client = CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private async Task MigrateDirectlyAsync()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_postgres.GetConnectionString(), b => b.UseVector())
            .Options;

        await using var db = new AppDbContext(opts, new FakeCurrentUserService());
        await db.Database.MigrateAsync();
    }

    private async Task InitRespawnerAsync()
    {
        await using var conn = new NpgsqlConnection(_postgres.GetConnectionString());
        await conn.OpenAsync();
        _respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
        {
            DbAdapter = DbAdapter.Postgres,
            SchemasToInclude = ["public"],
            TablesToIgnore = [new Table("__EFMigrationsHistory")],
        });
    }

    private static void RemoveHostedServices(IServiceCollection services, string assemblyOrNamespacePrefix)
    {
        var toRemove = services
            .Where(d => d.ServiceType == typeof(IHostedService) &&
                        (d.ImplementationType?.Assembly.GetName().Name?.StartsWith(assemblyOrNamespacePrefix) == true ||
                         d.ImplementationType?.Namespace?.StartsWith(assemblyOrNamespacePrefix) == true))
            .ToList();

        foreach (var sd in toRemove)
            services.Remove(sd);
    }

    private static void ReplaceService<TService>(IServiceCollection services, ServiceDescriptor replacement)
        where TService : class
    {
        var existing = services.SingleOrDefault(d => d.ServiceType == typeof(TService));
        if (existing is not null) services.Remove(existing);
        services.Add(replacement);
    }
}
