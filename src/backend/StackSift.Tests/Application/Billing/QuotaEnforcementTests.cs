using FluentAssertions;
using Moq;
using StackSift.Application.Commands.AiAnalyses;
using StackSift.Application.Commands.Projects;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Tests.Application.Billing;

public class CreateProjectQuotaTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IOrganizationRepository> _orgs = new();
    private readonly Mock<IProjectRepository> _projects = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Guid _orgId = Guid.NewGuid();

    public CreateProjectQuotaTests()
    {
        _currentUser.Setup(x => x.OrganizationId).Returns(_orgId);
        _uow.Setup(x => x.Organizations).Returns(_orgs.Object);
        _uow.Setup(x => x.Projects).Returns(_projects.Object);
    }

    [Fact]
    public async Task FreeOrg_AtLimit_ThrowsPlanLimitExceeded()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Plan = Plan.Free });
        _projects.Setup(x => x.GetActiveCountByOrganizationIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var handler = new CreateProjectCommandHandler(_uow.Object, _currentUser.Object);

        var ex = await Assert.ThrowsAsync<PlanLimitExceededException>(() =>
            handler.Handle(new CreateProjectCommand("Project Two", null, "#000000"), default));

        ex.Resource.Should().Be("projects");
        ex.Limit.Should().Be(1);
        ex.Plan.Should().Be(Plan.Free);
    }

    [Fact]
    public async Task FreeOrg_BelowLimit_Succeeds()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Plan = Plan.Free });
        _projects.Setup(x => x.GetActiveCountByOrganizationIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);
        _projects.Setup(x => x.SlugExistsInOrgAsync(It.IsAny<string>(), _orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var handler = new CreateProjectCommandHandler(_uow.Object, _currentUser.Object);

        var result = await handler.Handle(new CreateProjectCommand("First", null, "#000000"), default);

        result.Should().NotBeNull();
        _projects.Verify(x => x.AddAsync(It.IsAny<Project>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task IndieOrg_AtLimit_ThrowsPlanLimitExceeded()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Plan = Plan.Indie });
        _projects.Setup(x => x.GetActiveCountByOrganizationIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(5);

        var handler = new CreateProjectCommandHandler(_uow.Object, _currentUser.Object);

        var ex = await Assert.ThrowsAsync<PlanLimitExceededException>(() =>
            handler.Handle(new CreateProjectCommand("Project Six", null, "#000000"), default));

        ex.Limit.Should().Be(5);
        ex.Plan.Should().Be(Plan.Indie);
    }

    [Fact]
    public async Task TeamOrg_AtArbitraryCount_DoesNotQueryProjectCount_AndSucceeds()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Plan = Plan.Team });
        _projects.Setup(x => x.SlugExistsInOrgAsync(It.IsAny<string>(), _orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var handler = new CreateProjectCommandHandler(_uow.Object, _currentUser.Object);

        var result = await handler.Handle(new CreateProjectCommand("anything", null, "#000000"), default);

        result.Should().NotBeNull();
        _projects.Verify(x => x.GetActiveCountByOrganizationIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}

public class TriggerAiAnalysisQuotaTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IOrganizationRepository> _orgs = new();
    private readonly Mock<IIncidentRepository> _incidents = new();
    private readonly Mock<IAiAnalysisRepository> _analyses = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Mock<IAiAnalysisJobRunner> _jobRunner = new();
    private readonly Guid _orgId = Guid.NewGuid();
    private readonly Guid _incidentId = Guid.NewGuid();

    public TriggerAiAnalysisQuotaTests()
    {
        _currentUser.Setup(x => x.OrganizationId).Returns(_orgId);
        _uow.Setup(x => x.Organizations).Returns(_orgs.Object);
        _uow.Setup(x => x.Incidents).Returns(_incidents.Object);
        _uow.Setup(x => x.AiAnalyses).Returns(_analyses.Object);

        _incidents.Setup(x => x.GetByIdAsync(_incidentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Incident
            {
                Id = _incidentId,
                OrganizationId = _orgId,
                ProjectId = Guid.NewGuid(),
                Title = "X",
            });
    }

    [Fact]
    public async Task FreeOrg_At10Analyses_Throws()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Plan = Plan.Free });
        _analyses.Setup(x => x.GetCountByOrgSinceAsync(_orgId, It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(10);

        var handler = new TriggerAiAnalysisCommandHandler(_uow.Object, _currentUser.Object, _jobRunner.Object);

        var ex = await Assert.ThrowsAsync<PlanLimitExceededException>(() =>
            handler.Handle(new TriggerAiAnalysisCommand(_incidentId), default));

        ex.Limit.Should().Be(10);
        ex.Plan.Should().Be(Plan.Free);
    }

    [Fact]
    public async Task IndieOrg_At100Analyses_Throws()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization
            {
                Id = _orgId,
                Plan = Plan.Indie,
                CurrentPeriodEnd = DateTimeOffset.UtcNow.AddDays(10),
            });
        _analyses.Setup(x => x.GetCountByOrgSinceAsync(_orgId, It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(100);

        var handler = new TriggerAiAnalysisCommandHandler(_uow.Object, _currentUser.Object, _jobRunner.Object);

        await Assert.ThrowsAsync<PlanLimitExceededException>(() =>
            handler.Handle(new TriggerAiAnalysisCommand(_incidentId), default));
    }

    [Fact]
    public async Task TeamOrg_AnyCount_DoesNotQuery_AndSucceeds()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Plan = Plan.Team });

        var handler = new TriggerAiAnalysisCommandHandler(_uow.Object, _currentUser.Object, _jobRunner.Object);
        var result = await handler.Handle(new TriggerAiAnalysisCommand(_incidentId), default);

        result.Should().NotBeNull();
        _analyses.Verify(x => x.GetCountByOrgSinceAsync(
            It.IsAny<Guid>(), It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()), Times.Never);
        _jobRunner.Verify(x => x.Enqueue(It.IsAny<Guid>()), Times.Once);
    }

    [Fact]
    public async Task PaidPlan_PeriodStart_DerivesFromCurrentPeriodEnd_MinusOneMonth()
    {
        var periodEnd = new DateTimeOffset(2026, 6, 15, 12, 0, 0, TimeSpan.Zero);
        var expectedStart = periodEnd.AddMonths(-1);

        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization
            {
                Id = _orgId,
                Plan = Plan.Indie,
                CurrentPeriodEnd = periodEnd,
            });

        DateTimeOffset? capturedSince = null;
        _analyses.Setup(x => x.GetCountByOrgSinceAsync(_orgId, It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .Callback<Guid, DateTimeOffset, CancellationToken>((_, since, _) => capturedSince = since)
            .ReturnsAsync(0);

        var handler = new TriggerAiAnalysisCommandHandler(_uow.Object, _currentUser.Object, _jobRunner.Object);
        await handler.Handle(new TriggerAiAnalysisCommand(_incidentId), default);

        capturedSince.Should().Be(expectedStart);
    }

    [Fact]
    public async Task FreePlan_PeriodStart_IsFirstOfCalendarMonthUtc()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Plan = Plan.Free });

        DateTimeOffset? capturedSince = null;
        _analyses.Setup(x => x.GetCountByOrgSinceAsync(_orgId, It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .Callback<Guid, DateTimeOffset, CancellationToken>((_, since, _) => capturedSince = since)
            .ReturnsAsync(0);

        var handler = new TriggerAiAnalysisCommandHandler(_uow.Object, _currentUser.Object, _jobRunner.Object);
        await handler.Handle(new TriggerAiAnalysisCommand(_incidentId), default);

        capturedSince.Should().NotBeNull();
        capturedSince!.Value.Day.Should().Be(1);
        capturedSince.Value.Hour.Should().Be(0);
        capturedSince.Value.Offset.Should().Be(TimeSpan.Zero);
    }
}
