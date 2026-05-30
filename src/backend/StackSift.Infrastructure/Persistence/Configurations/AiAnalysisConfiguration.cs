using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Pgvector;
using StackSift.Domain.Entities;

namespace StackSift.Infrastructure.Persistence.Configurations;

public class AiAnalysisConfiguration : IEntityTypeConfiguration<AiAnalysis>
{
    public void Configure(EntityTypeBuilder<AiAnalysis> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.Status).HasConversion<string>().IsRequired();
        builder.Property(e => e.Summary).HasMaxLength(2000);
        builder.Property(e => e.RootCause).HasMaxLength(2000);
        builder.Property(e => e.SuggestedFixes).HasColumnType("text[]");
        builder.Property(e => e.RelevantLogIds).HasColumnType("uuid[]");

        builder.Property(e => e.Embedding)
            .HasConversion(new ValueConverter<float[]?, Vector?>(
                arr => arr == null ? null : new Vector(arr),
                v => v == null ? null : v.ToArray()))
            .HasColumnType("vector(1536)");
    }
}
