using Microsoft.EntityFrameworkCore;
using StackSift.Domain.Entities;
using StackSift.Domain.Interfaces;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Tests.Helpers;

/// <summary>
/// InMemory-safe AppDbContext subclass — strips the pgvector Embedding property so EF's
/// InMemory provider does not reject the Vector type. Unit tests use this; integration tests
/// targeting real Postgres use AppDbContext directly (see BE-17 Testcontainers plan).
/// </summary>
public sealed class TestAppDbContext(
    DbContextOptions<AppDbContext> options,
    ICurrentUserService currentUser)
    : AppDbContext(options, currentUser)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<AiAnalysis>().Ignore(a => a.Embedding);
    }

    public static TestAppDbContext Create(ICurrentUserService? currentUser = null)
    {
        var mockUser = currentUser ?? CreateGuestUser();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TestAppDbContext(options, mockUser);
    }

    private static ICurrentUserService CreateGuestUser()
    {
        var mock = new Moq.Mock<ICurrentUserService>();
        mock.Setup(u => u.IsAuthenticated).Returns(false);
        mock.Setup(u => u.Email).Returns("system");
        return mock.Object;
    }
}
