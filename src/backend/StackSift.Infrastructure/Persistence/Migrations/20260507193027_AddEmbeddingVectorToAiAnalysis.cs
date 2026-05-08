using Microsoft.EntityFrameworkCore.Migrations;
using Pgvector;

#nullable disable

namespace StackSift.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmbeddingVectorToAiAnalysis : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Vector>(
                name: "Embedding",
                table: "AiAnalyses",
                type: "vector(1536)",
                nullable: true);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_AiAnalyses_Embedding_cosine"
                    ON "AiAnalyses" USING hnsw ("Embedding" vector_cosine_ops)
                    WITH (m = 16, ef_construction = 64);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP INDEX IF EXISTS "IX_AiAnalyses_Embedding_cosine";""");

            migrationBuilder.DropColumn(
                name: "Embedding",
                table: "AiAnalyses");
        }
    }
}
