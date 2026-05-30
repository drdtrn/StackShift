using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Npgsql;
using StackSift.Domain.Interfaces;

namespace StackSift.Infrastructure.Persistence.Interceptors;

// Sets the Postgres session variable that the row-level-security policies read.
// Only runs inside an HTTP request; background workers leave it unset so the
// privileged (BYPASSRLS / superuser) connection they run under is unaffected.
public sealed class TenantConnectionInterceptor(ICurrentOrgProvider orgProvider) : DbConnectionInterceptor
{
    public override async Task ConnectionOpenedAsync(
        DbConnection connection,
        ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        if (connection is not NpgsqlConnection npg || !orgProvider.TenantFilterEnabled || !orgProvider.HasOrg)
            return;

        await using var cmd = npg.CreateCommand();
        cmd.CommandText = "SELECT set_config('app.current_org_id', @org, false);";
        cmd.Parameters.AddWithValue("org", orgProvider.OrgId.ToString());
        await cmd.ExecuteNonQueryAsync(cancellationToken);
    }
}
