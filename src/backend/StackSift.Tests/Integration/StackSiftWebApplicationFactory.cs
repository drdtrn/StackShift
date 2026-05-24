using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
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
/// Postgres (pgvector:pg16), Keycloak, and Redis. MassTransit and Hangfire server are disabled
/// so RabbitMQ is not required.
///
/// Configuration override strategy: environment variables set before _ = Server is accessed.
/// WebApplication.CreateBuilder() reads env vars at the very start of Program.cs (before any
/// service registration), so they are visible when AddInfrastructure reads ConnectionStrings and
/// Redis:ConnectionString. ConfigureAppConfiguration runs too late (after service registration)
/// for options consumed at DI-registration time such as ConnectionMultiplexer.Connect().
/// </summary>
public sealed class StackSiftWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private PostgreSqlContainer _postgres = null!;
    private KeycloakContainer _keycloak = null!;
    private RedisContainer _redis = null!;
    private Respawner _respawner = null!;

    /// <summary>Real Keycloak token client — use in tests to obtain JWTs.</summary>
    public KeycloakTokenClient Tokens { get; private set; } = null!;

    /// <summary>Base URL of the Testcontainers Keycloak instance.</summary>
    public string KeycloakBaseAddress => _keycloak.GetBaseAddress();

    /// <summary>Auto-generated secret for the `stacksift-backend-admin` service-account client.</summary>
    public string KeycloakAdminClientSecret { get; private set; } = "";

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
        KeycloakAdminClientSecret = await KeycloakTestRealmSeeder.SeedAsync(_keycloak.GetBaseAddress());

        // Run EF Core migrations directly so Respawn can be initialised before
        // the first test hits the host (avoids a race with the lazy host build).
        await MigrateDirectlyAsync();

        // Inject container addresses as environment variables BEFORE accessing Server.
        // WebApplication.CreateBuilder() reads env vars at the very start of Program.cs —
        // before AddInfrastructure is called — so this is the only reliable way to override
        // config values that are consumed eagerly at DI-registration time (e.g.
        // ConnectionMultiplexer.Connect() in ServiceCollectionExtensions).
        // ConfigureAppConfiguration runs after service registration and arrives too late.
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", _postgres.GetConnectionString());
        Environment.SetEnvironmentVariable("Keycloak__AuthServerUrl", _keycloak.GetBaseAddress());
        Environment.SetEnvironmentVariable("Keycloak__Realm", KeycloakTestRealmSeeder.RealmName);
        Environment.SetEnvironmentVariable("Keycloak__Resource", KeycloakTestRealmSeeder.ResourceServer);
        Environment.SetEnvironmentVariable("Keycloak__VerifyTokenAudience", "true");
        Environment.SetEnvironmentVariable("Keycloak__RequireHttpsMetadata", "false");
        Environment.SetEnvironmentVariable("Keycloak__Admin__RealmUrl",
            $"{_keycloak.GetBaseAddress().TrimEnd('/')}/realms/{KeycloakTestRealmSeeder.RealmName}");
        Environment.SetEnvironmentVariable("Keycloak__Admin__AdminBaseUrl",
            $"{_keycloak.GetBaseAddress().TrimEnd('/')}/admin/realms/{KeycloakTestRealmSeeder.RealmName}");
        Environment.SetEnvironmentVariable("Keycloak__Admin__AdminClientId",
            KeycloakTestRealmSeeder.AdminServiceAccountClientId);
        Environment.SetEnvironmentVariable("Keycloak__Admin__AdminClientSecret",
            KeycloakAdminClientSecret);
        Environment.SetEnvironmentVariable("Redis__ConnectionString", _redis.GetConnectionString());
        Environment.SetEnvironmentVariable("Serilog__Loki__Url", "");

        // Warm up the test server — Program.cs now reads the env vars above.
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
        Dispose();
        if (_postgres is not null) await _postgres.DisposeAsync();
        if (_keycloak is not null) await _keycloak.DisposeAsync();
        if (_redis is not null) await _redis.DisposeAsync();

        // Clean up env vars so they don't leak into other test processes.
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", null);
        Environment.SetEnvironmentVariable("Keycloak__AuthServerUrl", null);
        Environment.SetEnvironmentVariable("Keycloak__Realm", null);
        Environment.SetEnvironmentVariable("Keycloak__Resource", null);
        Environment.SetEnvironmentVariable("Keycloak__VerifyTokenAudience", null);
        Environment.SetEnvironmentVariable("Keycloak__RequireHttpsMetadata", null);
        Environment.SetEnvironmentVariable("Keycloak__Admin__RealmUrl", null);
        Environment.SetEnvironmentVariable("Keycloak__Admin__AdminBaseUrl", null);
        Environment.SetEnvironmentVariable("Keycloak__Admin__AdminClientId", null);
        Environment.SetEnvironmentVariable("Keycloak__Admin__AdminClientSecret", null);
        Environment.SetEnvironmentVariable("Redis__ConnectionString", null);
        Environment.SetEnvironmentVariable("Serilog__Loki__Url", null);
    }

    // ── WebApplicationFactory overrides ──────────────────────────────────────

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
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

    public async Task ResetDatabaseAsync()
    {
        await using var conn = new NpgsqlConnection(_postgres.GetConnectionString());
        await conn.OpenAsync();
        await _respawner.ResetAsync(conn);
    }

    public HttpClient CreateUnauthenticatedClient()
        => CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

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
