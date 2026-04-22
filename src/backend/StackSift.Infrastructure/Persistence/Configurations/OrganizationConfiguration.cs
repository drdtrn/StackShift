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

        builder.HasIndex(e => e.Slug).IsUnique();

        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}