using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StackSift.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GrantStacksiftAppRolePrivileges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Role-guarded so it is a no-op where the runtime roles are absent (the
            // plain test container). Runs as stacksift_owner in prod, which owns the
            // migrated tables and can grant on them and set its own default privileges.
            // Superuser-only grants (role membership, DATABASE CREATE) live in the image init hook.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'stacksift_app')
                       AND EXISTS (SELECT FROM pg_roles WHERE rolname = 'stacksift_owner') THEN
                        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO stacksift_app;
                        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO stacksift_app;
                        ALTER DEFAULT PRIVILEGES FOR ROLE stacksift_owner IN SCHEMA public
                            GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO stacksift_app;
                        ALTER DEFAULT PRIVILEGES FOR ROLE stacksift_owner IN SCHEMA public
                            GRANT USAGE, SELECT ON SEQUENCES TO stacksift_app;
                    END IF;
                END
                $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'stacksift_app')
                       AND EXISTS (SELECT FROM pg_roles WHERE rolname = 'stacksift_owner') THEN
                        ALTER DEFAULT PRIVILEGES FOR ROLE stacksift_owner IN SCHEMA public
                            REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM stacksift_app;
                        ALTER DEFAULT PRIVILEGES FOR ROLE stacksift_owner IN SCHEMA public
                            REVOKE USAGE, SELECT ON SEQUENCES FROM stacksift_app;
                        REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM stacksift_app;
                        REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public FROM stacksift_app;
                    END IF;
                END
                $$;
                """);
        }
    }
}
