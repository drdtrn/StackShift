using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StackSift.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditLogAppendOnlyTrigger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Make AuditLogEntries append-only: a BEFORE DELETE trigger raises
            // unless the session opts in via app.allow_audit_delete = 'on'. The
            // retention job sets that GUC inside its prune transaction.
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION audit_log_entries_no_delete() RETURNS trigger AS $$
                BEGIN
                    IF current_setting('app.allow_audit_delete', true) = 'on' THEN
                        RETURN OLD;
                    END IF;
                    RAISE EXCEPTION 'AuditLogEntries are append-only';
                END;
                $$ LANGUAGE plpgsql;

                CREATE TRIGGER audit_log_entries_no_delete_trg
                    BEFORE DELETE ON "AuditLogEntries"
                    FOR EACH ROW EXECUTE FUNCTION audit_log_entries_no_delete();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TRIGGER IF EXISTS audit_log_entries_no_delete_trg ON "AuditLogEntries";
                DROP FUNCTION IF EXISTS audit_log_entries_no_delete();
                """);
        }
    }
}
