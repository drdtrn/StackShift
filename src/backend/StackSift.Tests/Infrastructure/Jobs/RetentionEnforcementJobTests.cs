using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Jobs;
using StackSift.Tests.Integration;
using Xunit;

namespace StackSift.Tests.Infrastructure.Jobs;

[Collection("Postgres")]
public sealed class RetentionEnforcementJobTests(PostgresContainerFixture fixture)
{
    [Fact]
    public async Task Indie_org_drops_alerts_older_than_180_days()
    {
        await fixture.ResetAsync();

        var org = await SeedOrgAsync(Plan.Indie);
        await SeedAlertsAsync(org.Id, count: 10, ageDays: 200);
        await SeedAlertsAsync(org.Id, count: 5, ageDays: 30); // within retention

        var sut = NewSut();
        await sut.ExecuteAsync(CancellationToken.None);

        await using var db = fixture.CreateDbContext();
        var remaining = await db.Alerts.CountAsync(a => a.OrganizationId == org.Id);
        remaining.Should().Be(5, "200-day-old rows are past Indie's 180d retention; 30-day-old rows survive");
    }

    [Fact]
    public async Task Team_org_keeps_alerts_within_365_day_window()
    {
        await fixture.ResetAsync();

        var org = await SeedOrgAsync(Plan.Team);
        await SeedAlertsAsync(org.Id, count: 10, ageDays: 200); // inside Team's 365d window

        var sut = NewSut();
        await sut.ExecuteAsync(CancellationToken.None);

        await using var db = fixture.CreateDbContext();
        var remaining = await db.Alerts.CountAsync(a => a.OrganizationId == org.Id);
        remaining.Should().Be(10);
    }

    [Fact]
    public async Task Free_org_drops_alerts_older_than_30_days()
    {
        await fixture.ResetAsync();

        var org = await SeedOrgAsync(Plan.Free);
        await SeedAlertsAsync(org.Id, count: 4, ageDays: 45);
        await SeedAlertsAsync(org.Id, count: 6, ageDays: 5);

        var sut = NewSut();
        await sut.ExecuteAsync(CancellationToken.None);

        await using var db = fixture.CreateDbContext();
        var remaining = await db.Alerts.CountAsync(a => a.OrganizationId == org.Id);
        remaining.Should().Be(6);
    }

    [Fact]
    public async Task Audit_log_entries_drop_past_365_day_floor_regardless_of_tier()
    {
        await fixture.ResetAsync();

        var org = await SeedOrgAsync(Plan.Team);
        await SeedAuditEntriesAsync(org.Id, count: 7, ageDays: 400);
        await SeedAuditEntriesAsync(org.Id, count: 3, ageDays: 90);

        var sut = NewSut();
        await sut.ExecuteAsync(CancellationToken.None);

        await using var db = fixture.CreateDbContext();
        var remaining = await db.AuditLogEntries.CountAsync(a => a.OrganizationId == org.Id);
        remaining.Should().Be(3);
    }

    private RetentionEnforcementJob NewSut()
    {
        var db = fixture.CreateDbContext();
        return new RetentionEnforcementJob(db, NullLogger<RetentionEnforcementJob>.Instance);
    }

    private async Task<Organization> SeedOrgAsync(Plan plan)
    {
        await using var db = fixture.CreateDbContext();
        var org = new Organization
        {
            Id = Guid.NewGuid(),
            Name = $"Org-{plan}",
            Plan = plan,
        };
        db.Organizations.Add(org);
        await db.SaveChangesAsync();
        return org;
    }

    private async Task SeedAlertsAsync(Guid orgId, int count, int ageDays)
    {
        await using var db = fixture.CreateDbContext();
        var ids = new List<Guid>(count);
        for (var i = 0; i < count; i++)
        {
            var id = Guid.NewGuid();
            ids.Add(id);
            db.Alerts.Add(new Alert
            {
                Id = id,
                OrganizationId = orgId,
                Title = $"alert-{i}",
                Description = "seed",
            });
        }
        await db.SaveChangesAsync();

        // AppDbContext.SaveChangesAsync clobbers CreatedAt on insert; back-date
        // via ExecuteUpdateAsync (bypasses the change tracker entirely).
        var createdAt = DateTimeOffset.UtcNow.AddDays(-ageDays);
        await db.Alerts
            .Where(a => ids.Contains(a.Id))
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.CreatedAt, createdAt));
    }

    private async Task SeedAuditEntriesAsync(Guid orgId, int count, int ageDays)
    {
        await using var db = fixture.CreateDbContext();
        var occurredAt = DateTimeOffset.UtcNow.AddDays(-ageDays);
        for (var i = 0; i < count; i++)
        {
            db.AuditLogEntries.Add(new AuditLogEntry
            {
                Id = Guid.NewGuid(),
                OrganizationId = orgId,
                Event = AuditEvent.MemberInvited,
                OccurredAt = occurredAt,
            });
        }
        await db.SaveChangesAsync();
        // AuditLogEntry is not AuditableEntity, so OccurredAt survives SaveChanges.
    }
}
