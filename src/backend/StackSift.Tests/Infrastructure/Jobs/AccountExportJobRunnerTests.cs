using System.IO.Compression;
using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Jobs;
using StackSift.Tests.Integration;
using Xunit;

namespace StackSift.Tests.Infrastructure.Jobs;

[Collection("Postgres")]
public sealed class AccountExportJobRunnerTests(PostgresContainerFixture fixture)
{
    [Fact]
    public async Task Pending_request_produces_zip_with_manifest_and_per_table_entries()
    {
        await fixture.ResetAsync();

        var (user, org) = await SeedUserAndOrgAsync();
        await SeedAlertsAsync(org.Id, count: 4);
        var requestId = await SeedPendingRequestAsync(user.Id);

        var storage = new InMemoryAccountExportStorage();
        var sut = new AccountExportJobRunner(
            fixture.CreateDbContext(),
            storage,
            NullLogger<AccountExportJobRunner>.Instance,
            new FakeCurrentOrgProvider());

        await sut.RunAsync(requestId, CancellationToken.None);

        await using var db = fixture.CreateDbContext();
        var refreshed = await db.AccountExportRequests.AsNoTracking()
            .FirstAsync(r => r.Id == requestId);
        refreshed.Status.Should().Be(AccountExportStatus.Ready);
        refreshed.ObjectKey.Should().NotBeNullOrEmpty();
        refreshed.SignedUrl.Should().Be("https://signed.example/" + refreshed.ObjectKey);
        refreshed.ExpiresAt.Should().NotBeNull();
        refreshed.SizeBytes.Should().BeGreaterThan(0);
        refreshed.ManifestSha256.Should().NotBeNullOrEmpty();

        storage.Uploads.Should().ContainSingle();
        var (_, _, bytes) = storage.Uploads.Single();

        using var archive = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);
        var entryNames = archive.Entries.Select(e => e.FullName).ToList();
        entryNames.Should().Contain("export-manifest.json");
        entryNames.Should().Contain("profile.json");
        entryNames.Should().Contain("alerts.csv");
        entryNames.Should().Contain("organizations.csv");

        var manifestEntry = archive.GetEntry("export-manifest.json")!;
        await using var s = manifestEntry.Open();
        using var doc = await JsonDocument.ParseAsync(s);
        doc.RootElement.GetProperty("user_id").GetGuid().Should().Be(user.Id);
        doc.RootElement.GetProperty("tables").GetProperty("alerts.csv").GetProperty("row_count").GetInt32()
            .Should().Be(4);
    }

    [Fact]
    public async Task Already_ready_request_is_a_no_op()
    {
        await fixture.ResetAsync();

        var (user, _) = await SeedUserAndOrgAsync();
        var requestId = Guid.NewGuid();
        await using (var db = fixture.CreateDbContext())
        {
            db.AccountExportRequests.Add(new AccountExportRequest
            {
                Id = requestId,
                UserId = user.Id,
                Status = AccountExportStatus.Ready,
                RequestedAt = DateTimeOffset.UtcNow.AddHours(-1),
                CompletedAt = DateTimeOffset.UtcNow,
                ObjectKey = "already-uploaded.zip",
                SignedUrl = "https://stale.example/",
            });
            await db.SaveChangesAsync();
        }

        var storage = new InMemoryAccountExportStorage();
        var sut = new AccountExportJobRunner(
            fixture.CreateDbContext(),
            storage,
            NullLogger<AccountExportJobRunner>.Instance,
            new FakeCurrentOrgProvider());

        await sut.RunAsync(requestId, CancellationToken.None);

        storage.Uploads.Should().BeEmpty();
    }

    private async Task<(User User, Organization Org)> SeedUserAndOrgAsync()
    {
        await using var db = fixture.CreateDbContext();
        var org = new Organization { Id = Guid.NewGuid(), Name = "Acme", Plan = Plan.Indie };
        db.Organizations.Add(org);
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "alice@example.com",
            DisplayName = "Alice",
            Role = UserRole.Owner,
            OrganizationId = org.Id,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return (user, org);
    }

    private async Task SeedAlertsAsync(Guid orgId, int count)
    {
        await using var db = fixture.CreateDbContext();
        for (var i = 0; i < count; i++)
        {
            db.Alerts.Add(new Alert
            {
                Id = Guid.NewGuid(),
                OrganizationId = orgId,
                ProjectId = Guid.NewGuid(),
                Title = $"alert {i}",
                Description = "seed",
                Severity = AlertSeverity.High,
                FiredAt = DateTimeOffset.UtcNow,
            });
        }
        await db.SaveChangesAsync();
    }

    private async Task<Guid> SeedPendingRequestAsync(Guid userId)
    {
        await using var db = fixture.CreateDbContext();
        var entity = new AccountExportRequest
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Status = AccountExportStatus.Pending,
            RequestedAt = DateTimeOffset.UtcNow,
        };
        db.AccountExportRequests.Add(entity);
        await db.SaveChangesAsync();
        return entity.Id;
    }

    private sealed class InMemoryAccountExportStorage : IAccountExportStorage
    {
        public List<(Guid UserId, Guid RequestId, byte[] Bytes)> Uploads { get; } = [];

        public async Task<AccountExportUploadResult> UploadAsync(
            Guid userId, Guid requestId, Stream content, CancellationToken ct)
        {
            using var ms = new MemoryStream();
            await content.CopyToAsync(ms, ct);
            var bytes = ms.ToArray();
            Uploads.Add((userId, requestId, bytes));

            var sha = System.Security.Cryptography.SHA256.HashData(bytes);
            return new AccountExportUploadResult(
                ObjectKey: $"{userId}/{requestId}.zip",
                SizeBytes: bytes.Length,
                Sha256Hex: Convert.ToHexString(sha).ToLowerInvariant());
        }

        public Task<string> GeneratePresignedUrlAsync(string objectKey, TimeSpan ttl, CancellationToken ct) =>
            Task.FromResult($"https://signed.example/{objectKey}");
    }
}
