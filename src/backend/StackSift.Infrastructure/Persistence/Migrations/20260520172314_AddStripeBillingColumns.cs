using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StackSift.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStripeBillingColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Organizations"
                ALTER COLUMN "Plan" TYPE character varying(20)
                USING CASE "Plan"
                    WHEN 0 THEN 'Free'
                    WHEN 1 THEN 'Indie'
                    WHEN 2 THEN 'Team'
                    ELSE 'Free'
                END;
                """);

            migrationBuilder.AddColumn<bool>(
                name: "CancelAtPeriodEnd",
                table: "Organizations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CurrentPeriodEnd",
                table: "Organizations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StripeCustomerId",
                table: "Organizations",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StripePriceId",
                table: "Organizations",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StripeSubscriptionId",
                table: "Organizations",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubscriptionStatus",
                table: "Organizations",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "None");

            migrationBuilder.CreateTable(
                name: "StripeWebhookEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    EventId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    EventType = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    ReceivedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ProcessedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ProcessingError = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    PayloadJson = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StripeWebhookEvents", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Organizations_StripeCustomerId",
                table: "Organizations",
                column: "StripeCustomerId",
                unique: true,
                filter: "\"StripeCustomerId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_StripeWebhookEvents_EventId",
                table: "StripeWebhookEvents",
                column: "EventId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StripeWebhookEvents");

            migrationBuilder.DropIndex(
                name: "IX_Organizations_StripeCustomerId",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "CancelAtPeriodEnd",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "CurrentPeriodEnd",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "StripeCustomerId",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "StripePriceId",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "StripeSubscriptionId",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "SubscriptionStatus",
                table: "Organizations");

            migrationBuilder.Sql("""
                ALTER TABLE "Organizations"
                ALTER COLUMN "Plan" TYPE integer
                USING CASE "Plan"
                    WHEN 'Free' THEN 0
                    WHEN 'Indie' THEN 1
                    WHEN 'Team' THEN 2
                    ELSE 0
                END;
                """);
        }
    }
}
