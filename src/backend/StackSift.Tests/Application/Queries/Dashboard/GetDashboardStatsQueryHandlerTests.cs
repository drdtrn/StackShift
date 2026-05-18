using Moq;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Application.Queries.Dashboard;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Tests.Application.Queries.Dashboard;

public class GetDashboardStatsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Mock<ICacheService> _cache = new();
    private readonly Mock<IAlertRepository> _alerts = new();
    private readonly Mock<ILogEntryRepository> _logEntries = new();
    private readonly Mock<IIncidentRepository> _incidents = new();

    private readonly Guid _orgId = Guid.NewGuid();

    public GetDashboardStatsQueryHandlerTests()
    {
        _currentUser.Setup(x => x.OrganizationId).Returns(_orgId);
        _uow.Setup(x => x.Alerts).Returns(_alerts.Object);
        _uow.Setup(x => x.LogEntries).Returns(_logEntries.Object);
        _uow.Setup(x => x.Incidents).Returns(_incidents.Object);
    }

    [Fact]
    public async Task Handle_CacheMiss_QueriesDbAndPopulatesCache()
    {
        // Arrange
        _cache.Setup(x => x.GetAsync<DashboardStatsDto>(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((DashboardStatsDto?)null);

        _alerts.Setup(x => x.GetActiveCountByOrganizationIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(3);
        _logEntries.Setup(x => x.GetTotalTodayByOrganizationIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1200L);
        _incidents.Setup(x => x.GetOpenCountByOrganizationIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(2);

        var handler = new GetDashboardStatsQueryHandler(_uow.Object, _currentUser.Object, _cache.Object);

        // Act
        var result = await handler.Handle(new GetDashboardStatsQuery(), CancellationToken.None);

        // Assert — DB queries were called
        _alerts.Verify(x => x.GetActiveCountByOrganizationIdAsync(_orgId, It.IsAny<CancellationToken>()), Times.Once);
        _logEntries.Verify(x => x.GetTotalTodayByOrganizationIdAsync(_orgId, It.IsAny<CancellationToken>()), Times.Once);
        _incidents.Verify(x => x.GetOpenCountByOrganizationIdAsync(_orgId, It.IsAny<CancellationToken>()), Times.Once);

        // Assert — result is correct
        Assert.Equal(3, result.ActiveAlertCount);
        Assert.Equal(1200L, result.TotalLogsToday);
        Assert.Equal(2, result.OpenIncidentCount);

        // Assert — cache was populated with 60s TTL
        _cache.Verify(x => x.SetAsync(
            $"dashboard:stats:{_orgId}",
            It.Is<DashboardStatsDto>(d => d.ActiveAlertCount == 3 && d.TotalLogsToday == 1200 && d.OpenIncidentCount == 2),
            TimeSpan.FromSeconds(60),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_CacheHit_ReturnsFromCacheWithoutHittingDb()
    {
        // Arrange
        var cached = new DashboardStatsDto(5, 999L, 1);
        _cache.Setup(x => x.GetAsync<DashboardStatsDto>($"dashboard:stats:{_orgId}", It.IsAny<CancellationToken>()))
            .ReturnsAsync(cached);

        var handler = new GetDashboardStatsQueryHandler(_uow.Object, _currentUser.Object, _cache.Object);

        // Act
        var result = await handler.Handle(new GetDashboardStatsQuery(), CancellationToken.None);

        // Assert — returned the cached value
        Assert.Equal(cached, result);

        // Assert — DB was never touched
        _alerts.Verify(x => x.GetActiveCountByOrganizationIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _logEntries.Verify(x => x.GetTotalTodayByOrganizationIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _incidents.Verify(x => x.GetOpenCountByOrganizationIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
