using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StackSift.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRowLevelSecurity : Migration
    {
        private static readonly (string Table, string Policy)[] Targets =
        [
            ("Incidents", "incidents_tenant_isolation"),
            ("Alerts", "alerts_tenant_isolation"),
            ("AiAnalyses", "aianalyses_tenant_isolation"),
        ];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var (table, policy) in Targets)
            {
                migrationBuilder.Sql($"""
                    ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY;
                    ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY;
                    CREATE POLICY {policy} ON "{table}"
                        USING ("OrganizationId" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
                        WITH CHECK ("OrganizationId" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
                    """);
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var (table, policy) in Targets)
            {
                migrationBuilder.Sql($"""
                    DROP POLICY IF EXISTS {policy} ON "{table}";
                    ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY;
                    """);
            }
        }
    }
}
