using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StackSift.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EnablePgExtensions : Migration
    {
        // Plan 09 §9.13. Enables Postgres extensions the DBA observability path
        // depends on. pg_stat_statements is the canonical slow-query view;
        // pgcrypto is required by Plan 02's HMAC backfill and is enabled here
        // idempotently so a fresh cluster does not need a separate manual step;
        // pgvector is the existing RAG embedding storage and is already in
        // every migration's model snapshot — listed here for completeness.
        //
        // The shared_preload_libraries change in postgresql.overrides.conf
        // (Plan 09 §9.4 / Plan 12) requires a Postgres restart to take effect;
        // the StackSift Postgres image installs both the extension and the
        // postgresql.conf line on the same boot.
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS pg_stat_statements;");
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS vector;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentionally not dropping the extensions on Down — other
            // migrations may have created objects that depend on them
            // (e.g. pgvector columns).
        }
    }
}
