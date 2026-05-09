using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StackSift.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Partial covering index for IncidentRepository.GetByProjectIdAsync.
            // Before: Seq Scan on ~50 k rows. After: Index Scan on a few hundred active rows.
            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_Incidents_OrgId_ProjectId_StartedAt_Active"
                ON "Incidents" ("OrganizationId", "ProjectId", "StartedAt" DESC)
                WHERE "IsDeleted" = false AND "Status" IN ('Open', 'Acknowledged');
                """);

            // Covering index for AlertRepository.GetActiveCountByOrganizationIdAsync.
            // INCLUDE (Severity) lets the planner satisfy the count without a heap fetch.
            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_Alerts_OrgId_FiredAt_Active"
                ON "Alerts" ("OrganizationId", "FiredAt" DESC)
                INCLUDE ("Severity")
                WHERE "IsDeleted" = false;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP INDEX IF EXISTS "IX_Incidents_OrgId_ProjectId_StartedAt_Active";""");
            migrationBuilder.Sql("""DROP INDEX IF EXISTS "IX_Alerts_OrgId_FiredAt_Active";""");
        }
    }
}
