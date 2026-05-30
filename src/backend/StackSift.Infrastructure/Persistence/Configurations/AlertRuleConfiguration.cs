using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StackSift.Domain.Entities;

namespace StackSift.Infrastructure.Persistence.Configurations;

public class AlertRuleConfiguration : IEntityTypeConfiguration<AlertRule>
{
    public void Configure(EntityTypeBuilder<AlertRule> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.Name).IsRequired().HasMaxLength(200);
        builder.Property(e => e.Condition).HasConversion<string>().IsRequired();
        builder.Property(e => e.Threshold).HasColumnType("decimal(18,4)");
        builder.Property(e => e.LogLevel).HasConversion<string>();
        builder.Property(e => e.Severity).HasConversion<string>().IsRequired();
        builder.Property(e => e.Pattern).HasMaxLength(500);
    }
}