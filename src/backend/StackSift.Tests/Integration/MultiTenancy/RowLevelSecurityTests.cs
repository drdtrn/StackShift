using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Configuration;
using StackSift.Infrastructure.Persistence;
using StackSift.Infrastructure.Persistence.Interceptors;
using StackSift.Tests.Helpers;
using Xunit;

namespace StackSift.Tests.Integration.MultiTenancy;

[Collection("Postgres")]
public sealed class RowLevelSecurityTests(PostgresContainerFixture fixture)
{
    private const string AppRole = "rls_test_app";
    private const string AppPassword = "rls_test_pw";

    [Fact]
    public async Task Non_superuser_role_only_sees_rows_for_the_session_org()
    {
        await fixture.ResetAsync();
        await EnsureNonBypassRoleAsync();

        var orgA = Guid.NewGuid();
        var orgB = Guid.NewGuid();
        await SeedIncidentAsync(orgA);

        await using var conn = new NpgsqlConnection(AppRoleConnectionString());
        await conn.OpenAsync();

        (await CountIncidentsAsync(conn, orgA)).Should().Be(1, "session org matches the row's org");
        (await CountIncidentsAsync(conn, orgB)).Should().Be(0, "RLS hides another org's rows");
        (await CountIncidentsUnsetAsync(conn)).Should().Be(0, "unset session var is fail-closed");
    }

    [Fact]
    public async Task Superuser_bypasses_rls()
    {
        await fixture.ResetAsync();
        var orgA = Guid.NewGuid();
        await SeedIncidentAsync(orgA);

        await using var conn = new NpgsqlConnection(fixture.GetConnectionString());
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM \"Incidents\";";
        var count = (long)(await cmd.ExecuteScalarAsync())!;
        count.Should().Be(1, "the bootstrap superuser bypasses row-level security");
    }

    [Fact]
    public async Task Non_superuser_writes_are_constrained_by_rls()
    {
        await fixture.ResetAsync();
        await EnsureNonBypassRoleAsync();

        var orgA = Guid.NewGuid();
        await SeedIncidentAsync(orgA);

        await using var conn = new NpgsqlConnection(AppRoleConnectionString());
        await conn.OpenAsync();

        await SetOrgAsync(conn, Guid.NewGuid());
        (await UpdateTitlesAsync(conn)).Should().Be(0, "RLS hides another org's rows from UPDATE");

        await SetOrgAsync(conn, orgA);
        (await UpdateTitlesAsync(conn)).Should().Be(1, "the session org's own row is writable");

        await SetOrgAsync(conn, orgA);
        var moveOut = async () => await ExecuteAsync(conn, $"UPDATE \"Incidents\" SET \"OrganizationId\" = '{Guid.NewGuid()}';");
        await moveOut.Should().ThrowAsync<PostgresException>("WITH CHECK blocks moving a row out of the tenant");
    }

    [Fact]
    public async Task Role_switching_interceptor_enforces_rls_and_bypasses_in_system_scope()
    {
        await fixture.ResetAsync();
        await EnsureCutoverRolesAsync();

        var orgA = Guid.NewGuid();
        await SeedIncidentAsync(orgA);

        var dbOptions = Options.Create(new DatabaseOptions { RlsRoleSwitching = true });

        (await CountViaInterceptorAsync(new FakeCurrentOrgProvider { OrgId = orgA, TenantFilterEnabled = true }, dbOptions))
            .Should().Be(1, "scoped to its own org");
        (await CountViaInterceptorAsync(new FakeCurrentOrgProvider { OrgId = Guid.NewGuid(), TenantFilterEnabled = true }, dbOptions))
            .Should().Be(0, "scoped to another org");
        (await CountViaInterceptorAsync(new FakeCurrentOrgProvider { TenantFilterEnabled = true }, dbOptions))
            .Should().Be(0, "no org -> empty GUC -> fail-closed");
        (await CountViaInterceptorAsync(new FakeCurrentOrgProvider { IsSystemScope = true }, dbOptions))
            .Should().Be(1, "explicit system scope assumes the BYPASSRLS owner");
    }

    private static async Task<long> CountIncidentsAsync(NpgsqlConnection conn, Guid org)
    {
        await using var set = conn.CreateCommand();
        set.CommandText = "SELECT set_config('app.current_org_id', @org, false);";
        set.Parameters.AddWithValue("org", org.ToString());
        await set.ExecuteNonQueryAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM \"Incidents\";";
        return (long)(await cmd.ExecuteScalarAsync())!;
    }

    private static async Task<long> CountIncidentsUnsetAsync(NpgsqlConnection conn)
    {
        await using var reset = conn.CreateCommand();
        reset.CommandText = "RESET app.current_org_id;";
        await reset.ExecuteNonQueryAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM \"Incidents\";";
        return (long)(await cmd.ExecuteScalarAsync())!;
    }

    private async Task SeedIncidentAsync(Guid orgId)
    {
        await using var db = fixture.CreateDbContext();
        db.Organizations.Add(new Organization { Id = orgId, Name = "rls", Slug = $"rls-{orgId:N}", Plan = Plan.Free });
        db.Incidents.Add(new Incident
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            Status = IncidentStatus.Open,
            Title = "rls incident",
            Severity = AlertSeverity.High,
        });
        await db.SaveChangesAsync();
    }

    private async Task EnsureNonBypassRoleAsync()
    {
        await using var conn = new NpgsqlConnection(fixture.GetConnectionString());
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '{AppRole}') THEN
                    CREATE ROLE {AppRole} WITH LOGIN PASSWORD '{AppPassword}' NOBYPASSRLS;
                END IF;
            END
            $$;
            GRANT USAGE ON SCHEMA public TO {AppRole};
            GRANT SELECT, INSERT, UPDATE, DELETE ON "Incidents" TO {AppRole};
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    private string AppRoleConnectionString() =>
        new NpgsqlConnectionStringBuilder(fixture.GetConnectionString())
        {
            Username = AppRole,
            Password = AppPassword,
        }.ConnectionString;

    private const string CutoverApp = "stacksift_app";
    private const string CutoverAppPassword = "stacksift_app_test_pw";
    private const string CutoverOwnerPassword = "stacksift_owner_test_pw";

    private async Task EnsureCutoverRolesAsync()
    {
        await using var conn = new NpgsqlConnection(fixture.GetConnectionString());
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'stacksift_owner') THEN
                    CREATE ROLE stacksift_owner WITH LOGIN PASSWORD '{CutoverOwnerPassword}' BYPASSRLS;
                END IF;
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '{CutoverApp}') THEN
                    CREATE ROLE {CutoverApp} WITH LOGIN PASSWORD '{CutoverAppPassword}' NOBYPASSRLS;
                END IF;
            END
            $$;
            GRANT stacksift_owner TO {CutoverApp};
            GRANT USAGE ON SCHEMA public TO {CutoverApp}, stacksift_owner;
            GRANT SELECT, INSERT, UPDATE, DELETE ON "Incidents" TO {CutoverApp}, stacksift_owner;
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    private string AppCutoverConnectionString() =>
        new NpgsqlConnectionStringBuilder(fixture.GetConnectionString())
        {
            Username = CutoverApp,
            Password = CutoverAppPassword,
        }.ConnectionString;

    private async Task<int> CountViaInterceptorAsync(
        FakeCurrentOrgProvider provider,
        IOptions<DatabaseOptions> dbOptions)
    {
        var interceptor = new TenantConnectionInterceptor(provider, dbOptions);
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(AppCutoverConnectionString(), b => b.UseVector())
            .AddInterceptors(interceptor)
            .Options;
        await using var db = new AppDbContext(opts, new FakeCurrentUserService(), provider);
        return await db.Incidents.IgnoreQueryFilters().CountAsync();
    }

    private static async Task SetOrgAsync(NpgsqlConnection conn, Guid org)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT set_config('app.current_org_id', @org, false);";
        cmd.Parameters.AddWithValue("org", org.ToString());
        await cmd.ExecuteNonQueryAsync();
    }

    private static async Task<int> UpdateTitlesAsync(NpgsqlConnection conn)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE \"Incidents\" SET \"Title\" = 'changed';";
        return await cmd.ExecuteNonQueryAsync();
    }

    private static async Task ExecuteAsync(NpgsqlConnection conn, string sql)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        await cmd.ExecuteNonQueryAsync();
    }
}
