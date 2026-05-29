using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StackSift.Domain.Entities;

namespace StackSift.Infrastructure.Persistence.Configurations;

public class AccountErasureRequestConfiguration : IEntityTypeConfiguration<AccountErasureRequest>
{
    public void Configure(EntityTypeBuilder<AccountErasureRequest> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.Status).HasConversion<string>().IsRequired();
        builder.Property(e => e.RequestedAt).IsRequired();
        builder.Property(e => e.GraceEndsAt).IsRequired();
        builder.Property(e => e.CancellationTokenHash).HasMaxLength(64);
        builder.Property(e => e.AwaitingReviewReason).HasMaxLength(500);
        builder.Property(e => e.FailureReason).HasMaxLength(1000);

        builder.HasIndex(e => new { e.UserId, e.Status });
        builder.HasIndex(e => e.GraceEndsAt);

        builder.HasIndex(e => e.UserId)
            .IsUnique()
            .HasFilter("\"Status\" = 'PendingGrace' OR \"Status\" = 'AwaitingHumanReview'")
            .HasDatabaseName("ux_account_erasure_requests_active_per_user");
    }
}
