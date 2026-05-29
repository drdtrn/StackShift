using Amazon.S3;
using Elastic.Clients.Elasticsearch;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Jobs;
using StackSift.Infrastructure.Persistence;
using StackSift.Infrastructure.Storage;
using StackSift.Tests.Integration;
using Xunit;

namespace StackSift.Tests.Infrastructure.Jobs;

[Collection("Postgres")]
public sealed class AccountErasureJobTests(PostgresContainerFixture fixture)
{
    [Fact]
    public async Task Past_grace_with_owner_only_org_cascades_user_and_org_deletion()
    {
        await fixture.ResetAsync();
        var (user, org, requestId) = await SeedAsync(graceDaysAgo: 31, isOwnerOnly: true);

        var keycloak = new Mock<IAccountErasureService>();
        var job = NewJob(keycloak.Object);

        await job.ExecuteAsync(CancellationToken.None);

        await using var db = fixture.CreateDbContext();
        (await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Id == user.Id))
            .Should().BeFalse("the user row is hard-deleted past grace");
        (await db.Organizations.IgnoreQueryFilters().AnyAsync(o => o.Id == org.Id))
            .Should().BeFalse("the owner-only org is cascaded");
        var refreshedRequest = await db.AccountErasureRequests.FirstAsync(r => r.Id == requestId);
        refreshedRequest.Status.Should().Be(AccountErasureStatus.Completed);
        refreshedRequest.CompletedAt.Should().NotBeNull();

        keycloak.Verify(k => k.DeleteKeycloakUserAsync(user.Id, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Sole_admin_of_multi_user_org_is_paused_for_human_review()
    {
        await fixture.ResetAsync();
        var (user, org, requestId) = await SeedAsync(graceDaysAgo: 31, isOwnerOnly: false);

        var job = NewJob(new Mock<IAccountErasureService>().Object);
        await job.ExecuteAsync(CancellationToken.None);

        await using var db = fixture.CreateDbContext();
        var refreshed = await db.AccountErasureRequests.FirstAsync(r => r.Id == requestId);
        refreshed.Status.Should().Be(AccountErasureStatus.AwaitingHumanReview);
        refreshed.AwaitingReviewReason.Should().Contain("sole_owner");

        // User row survives in the soft-deleted state — the human-review path
        // does not hard-delete until support intervenes.
        (await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Id == user.Id)).Should().BeTrue();
        (await db.Organizations.IgnoreQueryFilters().AnyAsync(o => o.Id == org.Id)).Should().BeTrue();
    }

    [Fact]
    public async Task Within_grace_is_not_processed()
    {
        await fixture.ResetAsync();
        var (user, _, requestId) = await SeedAsync(graceDaysAgo: 5, isOwnerOnly: true);

        var keycloak = new Mock<IAccountErasureService>();
        var job = NewJob(keycloak.Object);
        await job.ExecuteAsync(CancellationToken.None);

        await using var db = fixture.CreateDbContext();
        (await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Id == user.Id))
            .Should().BeTrue("user is still soft-deleted but row survives during grace");
        var refreshed = await db.AccountErasureRequests.FirstAsync(r => r.Id == requestId);
        refreshed.Status.Should().Be(AccountErasureStatus.PendingGrace);

        keycloak.Verify(
            k => k.DeleteKeycloakUserAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    private AccountErasureJob NewJob(IAccountErasureService erasureService)
    {
        var db = fixture.CreateDbContext();
        var erasures = new AccountErasureContext(db);
        var s3Opts = Options.Create(new S3StorageOptions
        {
            BucketName = "stacksift-uploads",
            Endpoint = "http://minio:9000",
        });

        // ES + S3 are mocked at the boundary — the integration check is the
        // Postgres state machine; ES/S3 failures are logged and continue per
        // the job's design.
        var es = new ElasticsearchClient(new ElasticsearchClientSettings(new Uri("http://es-disabled:9200")));
        var s3 = new Mock<IAmazonS3>(MockBehavior.Loose);

        return new AccountErasureJob(
            db, erasures, erasureService, es, s3.Object, s3Opts,
            TimeProvider.System, NullLogger<AccountErasureJob>.Instance);
    }

    private async Task<(User User, Organization Org, Guid RequestId)> SeedAsync(
        int graceDaysAgo, bool isOwnerOnly)
    {
        var orgId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var requestId = Guid.NewGuid();

        await using (var db = fixture.CreateDbContext())
        {
            db.Organizations.Add(new Organization { Id = orgId, Name = "Acme", Plan = Plan.Free });
            db.Users.Add(new User
            {
                Id = userId,
                Email = "alice@example.com",
                DisplayName = "Alice",
                Role = UserRole.Owner,
                OrganizationId = orgId,
                IsDeleted = true,
                DeletedAt = DateTimeOffset.UtcNow.AddDays(-graceDaysAgo),
            });
            if (!isOwnerOnly)
            {
                db.Users.Add(new User
                {
                    Id = Guid.NewGuid(),
                    Email = "bob@example.com",
                    DisplayName = "Bob",
                    Role = UserRole.Member,
                    OrganizationId = orgId,
                });
            }
            db.AccountErasureRequests.Add(new AccountErasureRequest
            {
                Id = requestId,
                UserId = userId,
                Status = AccountErasureStatus.PendingGrace,
                RequestedAt = DateTimeOffset.UtcNow.AddDays(-graceDaysAgo),
                GraceEndsAt = DateTimeOffset.UtcNow.AddDays(-graceDaysAgo).AddDays(30),
                CancellationTokenHash = "00000000",
            });
            await db.SaveChangesAsync();
        }

        // Read back so the caller has fresh instances for assertions.
        await using var readDb = fixture.CreateDbContext();
        var user = await readDb.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);
        var org = await readDb.Organizations.IgnoreQueryFilters().FirstAsync(o => o.Id == orgId);
        return (user, org, requestId);
    }
}
