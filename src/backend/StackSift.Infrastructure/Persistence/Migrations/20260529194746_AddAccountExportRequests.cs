using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StackSift.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountExportRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AccountExportRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    RequestedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ObjectKey = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    SignedUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ManifestSha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: true),
                    FailureReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountExportRequests", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AccountExportRequests_RequestedAt",
                table: "AccountExportRequests",
                column: "RequestedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AccountExportRequests_UserId_Status",
                table: "AccountExportRequests",
                columns: new[] { "UserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "ux_account_export_requests_pending_per_user",
                table: "AccountExportRequests",
                column: "UserId",
                unique: true,
                filter: "\"Status\" = 'Pending'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AccountExportRequests");
        }
    }
}
