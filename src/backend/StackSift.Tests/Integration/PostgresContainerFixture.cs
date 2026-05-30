using Microsoft.EntityFrameworkCore;
using Npgsql;
using Respawn;
using Respawn.Graph;
using StackSift.Domain.Interfaces;
using StackSift.Infrastructure.Persistence;
using StackSift.Tests.Helpers;
using Testcontainers.PostgreSql;

namespace StackSift.Tests.Integration;

/// <summary>
/// xUnit collection definition — all tests decorated with [Collection("Postgres")]
/// share this single container instance (started once per test run, not per class).
/// </summary>
[CollectionDefinition("Postgres")]
public class PostgresCollection : ICollectionFixture<PostgresContainerFixture> { }

/// <summary>
/// Assembly-level Postgres fixture backed by a real pgvector/pgvector:pg16 container.
/// Migrations run once on startup; Respawn clears rows between tests in ~50ms.
/// </summary>
public sealed class PostgresContainerFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder()
        .WithImage("pgvector/pgvector:pg16")
        .Build();

    private Respawner _respawner = null!;

    public string GetConnectionString() => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();

        // Apply all EF Core migrations against the real Postgres + pgvector container.
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_container.GetConnectionString(), b => b.UseVector())
            .Options;

        await using var db = new AppDbContext(opts, new FakeCurrentUserService(), new FakeCurrentOrgProvider());
        await db.Database.MigrateAsync();

        // Wire up Respawn for fast per-test row deletion (keeps schema intact).
        await using var conn = new NpgsqlConnection(_container.GetConnectionString());
        await conn.OpenAsync();
        _respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
        {
            DbAdapter = DbAdapter.Postgres,
            SchemasToInclude = ["public"],
            TablesToIgnore = [new Table("__EFMigrationsHistory")],
        });
    }

    /// <summary>Creates a fresh AppDbContext scoped to the container's database.</summary>
    public AppDbContext CreateDbContext(
        FakeCurrentUserService? user = null,
        ICurrentOrgProvider? orgProvider = null)
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_container.GetConnectionString(), b => b.UseVector())
            .Options;
        return new AppDbContext(opts, user ?? new FakeCurrentUserService(), orgProvider ?? new FakeCurrentOrgProvider());
    }

    /// <summary>Clears all rows (except migration history) via Respawn — ~50ms per call.</summary>
    public async Task ResetAsync()
    {
        await using var conn = new NpgsqlConnection(_container.GetConnectionString());
        await conn.OpenAsync();
        await _respawner.ResetAsync(conn);
    }

    public async Task DisposeAsync() => await _container.DisposeAsync();
}
