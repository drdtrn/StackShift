using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StackSift.Domain.Entities;

namespace StackSift.Infrastructure.Persistence.Configurations;

public class InvitationConfiguration : IEntityTypeConfiguration<Invitation>
{
    public void Configure(EntityTypeBuilder<Invitation> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.Email).IsRequired().HasMaxLength(256);
        builder.Property(e => e.Token).IsRequired().HasMaxLength(128);
        builder.Property(e => e.Role).HasConversion<string>().IsRequired();

        builder.HasIndex(e => e.OrganizationId);
        builder.HasIndex(e => e.Token).IsUnique();

        // Only one pending invitation per email at a time. Re-invitation
        // after acceptance (or after a soft-delete) is allowed.
        builder.HasIndex(e => e.Email)
            .IsUnique()
            .HasFilter("\"AcceptedAt\" IS NULL AND \"IsDeleted\" = false");

        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}
