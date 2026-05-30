using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using Xunit;

namespace StackSift.Tests.Integration.MultiTenancy;

[Collection("Postgres")]
public sealed class AuditLogAppendOnlyTests(PostgresContainerFixture fixture)
{
    [Fact]
    public async Task Delete_without_opt_in_is_rejected_by_the_trigger()
    {
        await fixture.ResetAsync();
        var id = await SeedEntryAsync();

        await using var db = fixture.CreateDbContext();
        var act = async () => await db.AuditLogEntries.Where(a => a.Id == id).ExecuteDeleteAsync();

        await act.Should().ThrowAsync<PostgresException>()
            .Where(e => e.MessageText.Contains("append-only"));
    }

    [Fact]
    public async Task Delete_with_session_opt_in_succeeds()
    {
        await fixture.ResetAsync();
        var id = await SeedEntryAsync();

        await using var db = fixture.CreateDbContext();
        await using var tx = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync("SET LOCAL app.allow_audit_delete = 'on'");
        var deleted = await db.AuditLogEntries.Where(a => a.Id == id).ExecuteDeleteAsync();
        await tx.CommitAsync();

        deleted.Should().Be(1);
    }

    private async Task<Guid> SeedEntryAsync()
    {
        var id = Guid.NewGuid();
        await using var db = fixture.CreateDbContext();
        db.AuditLogEntries.Add(new AuditLogEntry
        {
            Id = id,
            OrganizationId = Guid.NewGuid(),
            Event = AuditEvent.MemberInvited,
            OccurredAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
        return id;
    }
}
