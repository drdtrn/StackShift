using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StackSift.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountErasureRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AccountErasureRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    RequestedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    GraceEndsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CancellationTokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    AwaitingReviewReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
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
                    table.PrimaryKey("PK_AccountErasureRequests", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AccountErasureRequests_GraceEndsAt",
                table: "AccountErasureRequests",
                column: "GraceEndsAt");

            migrationBuilder.CreateIndex(
                name: "IX_AccountErasureRequests_UserId_Status",
                table: "AccountErasureRequests",
                columns: new[] { "UserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "ux_account_erasure_requests_active_per_user",
                table: "AccountErasureRequests",
                column: "UserId",
                unique: true,
                filter: "\"Status\" = 'PendingGrace' OR \"Status\" = 'AwaitingHumanReview'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AccountErasureRequests");
        }
    }
}
