using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StackSift.Domain.Entities;

namespace StackSift.Infrastructure.Persistence.Configurations;

public class AccountExportRequestConfiguration : IEntityTypeConfiguration<AccountExportRequest>
{
    public void Configure(EntityTypeBuilder<AccountExportRequest> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.Status).HasConversion<string>().IsRequired();
        builder.Property(e => e.RequestedAt).IsRequired();
        builder.Property(e => e.ObjectKey).HasMaxLength(512);
        builder.Property(e => e.SignedUrl).HasMaxLength(2048);
        builder.Property(e => e.ManifestSha256).HasMaxLength(64);
        builder.Property(e => e.FailureReason).HasMaxLength(1000);

        // Article 15 reads with status=Pending are the hot path for rate-limit
        // and idempotency checks; this index keeps them O(log n) per user.
        builder.HasIndex(e => new { e.UserId, e.Status });
        builder.HasIndex(e => e.RequestedAt);

        // Filtered unique index — at most one pending request per user. The
        // 7-day rate limit is enforced application-side on top of this.
        builder.HasIndex(e => e.UserId)
            .IsUnique()
            .HasFilter("\"Status\" = 'Pending'")
            .HasDatabaseName("ux_account_export_requests_pending_per_user");
    }
}
