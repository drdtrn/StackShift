using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StackSift.Domain.Entities;

namespace StackSift.Infrastructure.Persistence.Configurations;

public class LogEntryConfiguration : IEntityTypeConfiguration<LogEntry>
{
    public void Configure(EntityTypeBuilder<LogEntry> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.Level).HasConversion<string>().IsRequired();
        builder.Property(e => e.Message).IsRequired();
        builder.Property(e => e.TraceId).HasMaxLength(64);
        builder.Property(e => e.SpanId).HasMaxLength(32);
        builder.Property(e => e.ServiceName).HasMaxLength(200);
        builder.Property(e => e.HostName).HasMaxLength(200);
        builder.Property(e => e.Metadata).HasColumnType("jsonb");

        builder.HasIndex(e => new { e.ProjectId, e.Timestamp }).IsDescending(false, true);
        builder.HasIndex(e => e.Level);

        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}