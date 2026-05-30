using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Tests.Helpers;
using Xunit;

namespace StackSift.Tests.Integration.MultiTenancy;

[Collection("Postgres")]
public sealed class TenantQueryFilterTests(PostgresContainerFixture fixture)
{
    private static readonly Type[] OrgScopedEntities =
    [
        typeof(Project), typeof(LogSource), typeof(AlertRule),
        typeof(Alert), typeof(Incident), typeof(AiAnalysis), typeof(LogEntry),
    ];

    [Fact]
    public void Every_org_scoped_entity_has_an_org_query_filter()
    {
        using var db = fixture.CreateDbContext();

        foreach (var clrType in OrgScopedEntities)
        {
            var entityType = db.Model.FindEntityType(clrType);
            entityType.Should().NotBeNull();

#pragma warning disable CS0618
            var filter = entityType!.GetQueryFilter();
#pragma warning restore CS0618
            filter.Should().NotBeNull($"{clrType.Name} must keep a query filter");
            filter!.ToString().Should().Contain(
                nameof(Project.OrganizationId),
                $"{clrType.Name}'s query filter must scope by OrganizationId");
        }
    }

    [Fact]
    public async Task Tenant_filter_enabled_hides_other_orgs_rows()
    {
        await fixture.ResetAsync();
        var (orgA, orgB) = await SeedTwoOrgsAsync();

        var scoped = new FakeCurrentOrgProvider { OrgId = orgA, TenantFilterEnabled = true };
        await using var db = fixture.CreateDbContext(orgProvider: scoped);

        var projects = await db.Projects.ToListAsync();
        var incidents = await db.Incidents.ToListAsync();

        projects.Should().OnlyContain(p => p.OrganizationId == orgA);
        incidents.Should().OnlyContain(i => i.OrganizationId == orgA);
        projects.Should().HaveCount(1);
        incidents.Should().HaveCount(1);
    }

    [Fact]
    public async Task Background_context_with_filter_disabled_sees_all_orgs()
    {
        await fixture.ResetAsync();
        var (orgA, orgB) = await SeedTwoOrgsAsync();

        var system = new FakeCurrentOrgProvider { OrgId = orgA, TenantFilterEnabled = false };
        await using var db = fixture.CreateDbContext(orgProvider: system);

        var projects = await db.Projects.Select(p => p.OrganizationId).ToListAsync();

        projects.Should().Contain(orgA).And.Contain(orgB);
    }

    private async Task<(Guid OrgA, Guid OrgB)> SeedTwoOrgsAsync()
    {
        var orgA = Guid.NewGuid();
        var orgB = Guid.NewGuid();

        await using var db = fixture.CreateDbContext();
        db.Organizations.Add(new Organization { Id = orgA, Name = "A", Slug = "org-a", Plan = Plan.Free });
        db.Organizations.Add(new Organization { Id = orgB, Name = "B", Slug = "org-b", Plan = Plan.Free });

        db.Projects.Add(NewProject(orgA, "a"));
        db.Projects.Add(NewProject(orgB, "b"));
        db.Incidents.Add(NewIncident(orgA));
        db.Incidents.Add(NewIncident(orgB));

        await db.SaveChangesAsync();
        return (orgA, orgB);
    }

    private static Project NewProject(Guid orgId, string slug) => new()
    {
        Id = Guid.NewGuid(),
        OrganizationId = orgId,
        Name = $"project-{slug}",
        Slug = slug,
        Color = "#3b82f6",
    };

    private static Incident NewIncident(Guid orgId) => new()
    {
        Id = Guid.NewGuid(),
        OrganizationId = orgId,
        Status = IncidentStatus.Open,
        Title = "incident",
        Severity = AlertSeverity.High,
    };
}
