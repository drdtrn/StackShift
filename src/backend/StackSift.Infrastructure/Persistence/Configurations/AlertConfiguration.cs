using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StackSift.Domain.Entities;

namespace StackSift.Infrastructure.Persistence.Configurations;

public class AlertConfiguration : IEntityTypeConfiguration<Alert>
{
    public void Configure(EntityTypeBuilder<Alert> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.Severity).HasConversion<string>().IsRequired();
        builder.Property(e => e.Title).IsRequired().HasMaxLength(500);
        builder.Property(e => e.Description).IsRequired().HasMaxLength(2000);

        builder.HasIndex(e => new { e.ProjectId, e.FiredAt });

        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}