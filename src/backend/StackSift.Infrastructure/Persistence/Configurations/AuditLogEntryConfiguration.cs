using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StackSift.Domain.Entities;

namespace StackSift.Infrastructure.Persistence.Configurations;

public class AuditLogEntryConfiguration : IEntityTypeConfiguration<AuditLogEntry>
{
    public void Configure(EntityTypeBuilder<AuditLogEntry> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
        builder.Property(e => e.ActorEmail).HasMaxLength(256);
        builder.Property(e => e.Event).HasConversion<string>().IsRequired();
        builder.Property(e => e.TargetType).HasMaxLength(100);
        builder.Property(e => e.Details).HasMaxLength(2000);
        builder.Property(e => e.OccurredAt).IsRequired();

        builder.HasIndex(e => new { e.OrganizationId, e.OccurredAt });
        builder.HasIndex(e => new { e.Event, e.OccurredAt });
    }
}
