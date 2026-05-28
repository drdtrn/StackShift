using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StackSift.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLogSourceKeyHashing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LogSources_ApiKey",
                table: "LogSources");

            migrationBuilder.AddColumn<string>(
                name: "KeyHash",
                table: "LogSources",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "KeyLastUsedAt",
                table: "LogSources",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "KeyPrefix",
                table: "LogSources",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "KeyRotatedAt",
                table: "LogSources",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.Sql("""
                CREATE EXTENSION IF NOT EXISTS pgcrypto;

                DO $$
                DECLARE
                    pepper_base64 text := current_setting('app.log_sources_key_pepper_base64', true);
                BEGIN
                    IF EXISTS (SELECT 1 FROM "LogSources")
                       AND (pepper_base64 IS NULL OR pepper_base64 = '') THEN
                        RAISE EXCEPTION 'app.log_sources_key_pepper_base64 must be set before backfilling log source key hashes';
                    END IF;

                    IF pepper_base64 IS NOT NULL AND pepper_base64 <> '' THEN
                        UPDATE "LogSources"
                        SET
                            "KeyPrefix" = SUBSTRING("ApiKey" FROM 1 FOR 8),
                            "KeyHash" = encode(hmac(convert_to("ApiKey", 'UTF8'), decode(pepper_base64, 'base64'), 'sha256'), 'hex');
                    END IF;
                END $$;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "KeyPrefix",
                table: "LogSources",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(8)",
                oldMaxLength: 8,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "KeyHash",
                table: "LogSources",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64,
                oldNullable: true);

            migrationBuilder.DropColumn(
                name: "ApiKey",
                table: "LogSources");

            migrationBuilder.CreateIndex(
                name: "IX_LogSources_KeyHash",
                table: "LogSources",
                column: "KeyHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LogSources_KeyPrefix",
                table: "LogSources",
                column: "KeyPrefix");

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LogSources_KeyHash",
                table: "LogSources");

            migrationBuilder.DropIndex(
                name: "IX_LogSources_KeyPrefix",
                table: "LogSources");

            migrationBuilder.DropColumn(
                name: "KeyHash",
                table: "LogSources");

            migrationBuilder.DropColumn(
                name: "KeyLastUsedAt",
                table: "LogSources");

            migrationBuilder.DropColumn(
                name: "KeyPrefix",
                table: "LogSources");

            migrationBuilder.DropColumn(
                name: "KeyRotatedAt",
                table: "LogSources");

            migrationBuilder.AddColumn<string>(
                name: "ApiKey",
                table: "LogSources",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_LogSources_ApiKey",
                table: "LogSources",
                column: "ApiKey");
        }
    }
}
