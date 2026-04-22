using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using StackSift.Infrastructure.Services;

namespace StackSift.Infrastructure.Persistence;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
        .UseNpgsql(
            "Host=localhost;Port=5432;Database=stacksift;Username=stacksift;Password=stacksift",
            b => b.UseVector())
        .Options;

        return new AppDbContext(opts, new SystemCurrentUserService());
    }
}