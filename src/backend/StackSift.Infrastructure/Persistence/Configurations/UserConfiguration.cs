using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StackSift.Domain.Entities;

namespace StackSift.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.Email).IsRequired().HasMaxLength(256);
        builder.Property(e => e.DisplayName).IsRequired().HasMaxLength(200);
        builder.Property(e => e.AvatarUrl).HasMaxLength(500);
        builder.Property(e => e.Role).HasConversion<string>().IsRequired();

        builder.HasIndex(e => e.Email).IsUnique();

        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}