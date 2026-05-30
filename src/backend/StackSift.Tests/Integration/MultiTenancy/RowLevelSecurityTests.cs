using FluentAssertions;
using Npgsql;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
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
            GRANT SELECT ON "Incidents" TO {AppRole};
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    private string AppRoleConnectionString() =>
        new NpgsqlConnectionStringBuilder(fixture.GetConnectionString())
        {
            Username = AppRole,
            Password = AppPassword,
        }.ConnectionString;
}
