using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StackSift.Domain.Entities;

namespace StackSift.Infrastructure.Persistence.Configurations;

public class OrganizationConfiguration : IEntityTypeConfiguration<Organization>
{
    public void Configure(EntityTypeBuilder<Organization> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.Name).IsRequired().HasMaxLength(200);
        builder.Property(e => e.Slug).IsRequired().HasMaxLength(100);
        builder.Property(e => e.LogoUrl).HasMaxLength(500);

        builder.Property(e => e.Plan).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.Property(e => e.StripeCustomerId).HasMaxLength(255);
        builder.Property(e => e.StripeSubscriptionId).HasMaxLength(255);
        builder.Property(e => e.StripePriceId).HasMaxLength(255);
        builder.Property(e => e.SubscriptionStatus).HasConversion<string>().HasMaxLength(50).IsRequired();

        builder.HasIndex(e => e.Slug).IsUnique();

        builder.HasIndex(e => e.StripeCustomerId)
            .IsUnique()
            .HasFilter("\"StripeCustomerId\" IS NOT NULL");

        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}
