using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StackSift.Domain.Entities;

namespace StackSift.Infrastructure.Persistence.Configurations;

public class StripeWebhookEventConfiguration : IEntityTypeConfiguration<StripeWebhookEvent>
{
    public void Configure(EntityTypeBuilder<StripeWebhookEvent> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.EventId).IsRequired().HasMaxLength(255);
        builder.Property(e => e.EventType).IsRequired().HasMaxLength(255);
        builder.Property(e => e.PayloadJson).IsRequired().HasColumnType("text");
        builder.Property(e => e.ProcessingError).HasMaxLength(2000);

        builder.HasIndex(e => e.EventId).IsUnique();

        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}
