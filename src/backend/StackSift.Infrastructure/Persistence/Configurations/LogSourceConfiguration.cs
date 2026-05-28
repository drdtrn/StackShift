using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StackSift.Domain.Entities;

namespace StackSift.Infrastructure.Persistence.Configurations;

public class LogSourceConfiguration : IEntityTypeConfiguration<LogSource>
{
    public void Configure(EntityTypeBuilder<LogSource> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.Name).IsRequired().HasMaxLength(200);
        builder.Property(e => e.Type).HasConversion<string>().IsRequired();
        builder.Property(e => e.IngestUrl).IsRequired().HasMaxLength(500);
        builder.Property(e => e.KeyHash).IsRequired().HasMaxLength(64);
        builder.Property(e => e.KeyPrefix).IsRequired().HasMaxLength(8);

        builder.HasIndex(e => e.KeyHash).IsUnique();
        builder.HasIndex(e => e.KeyPrefix);

        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}
