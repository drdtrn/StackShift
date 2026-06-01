using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Options;
using Npgsql;
using StackSift.Domain.Interfaces;
using StackSift.Infrastructure.Configuration;

namespace StackSift.Infrastructure.Persistence.Interceptors;

// Establishes the per-connection tenancy state the row-level-security policies
// read. With role switching off (dev/test, superuser connection) it only sets the
// org GUC when scoped. With role switching on (prod, stacksift_app connection) it
// runs deterministically on every open so pooled connections never carry stale
// state: an explicit system scope assumes the BYPASSRLS owner; everything else
// stays the app role with the org GUC (empty => RLS is fail-closed).
public sealed class TenantConnectionInterceptor(
    ICurrentOrgProvider orgProvider,
    IOptions<DatabaseOptions> databaseOptions) : DbConnectionInterceptor
{
    private const string OwnerRole = "stacksift_owner";

    public override async Task ConnectionOpenedAsync(
        DbConnection connection,
        ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        if (connection is not NpgsqlConnection npg)
            return;

        if (!databaseOptions.Value.RlsRoleSwitching)
        {
            if (orgProvider.TenantFilterEnabled && orgProvider.HasOrg)
                await SetOrgAsync(npg, orgProvider.OrgId.ToString(), cancellationToken);
            return;
        }

        if (orgProvider.IsSystemScope)
        {
            await ExecuteAsync(npg, $"SET ROLE \"{OwnerRole}\";", cancellationToken);
        }
        else
        {
            await ExecuteAsync(npg, "RESET ROLE;", cancellationToken);
            await SetOrgAsync(
                npg,
                orgProvider.HasOrg ? orgProvider.OrgId.ToString() : string.Empty,
                cancellationToken);
        }
    }

    private static async Task SetOrgAsync(NpgsqlConnection npg, string org, CancellationToken ct)
    {
        await using var cmd = npg.CreateCommand();
        cmd.CommandText = "SELECT set_config('app.current_org_id', @org, false);";
        cmd.Parameters.AddWithValue("org", org);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task ExecuteAsync(NpgsqlConnection npg, string sql, CancellationToken ct)
    {
        await using var cmd = npg.CreateCommand();
        cmd.CommandText = sql;
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
