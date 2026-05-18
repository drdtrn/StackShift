using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;

namespace StackSift.Application.Queries.Dashboard;

public record GetDashboardStatsQuery : IRequest<DashboardStatsDto>;

public class GetDashboardStatsQueryHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser,
    ICacheService cache)
    : IRequestHandler<GetDashboardStatsQuery, DashboardStatsDto>
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(60);

    public async Task<DashboardStatsDto> Handle(GetDashboardStatsQuery request, CancellationToken ct)
    {
        var orgId = currentUser.OrganizationId;
        var cacheKey = $"dashboard:stats:{orgId}";

        var cached = await cache.GetAsync<DashboardStatsDto>(cacheKey, ct);
        if (cached is not null)
            return cached;

        var activeAlertCount = await uow.Alerts.GetActiveCountByOrganizationIdAsync(orgId, ct);
        var totalLogsToday = await uow.LogEntries.GetTotalTodayByOrganizationIdAsync(orgId, ct);
        var openIncidentCount = await uow.Incidents.GetOpenCountByOrganizationIdAsync(orgId, ct);

        var stats = new DashboardStatsDto(activeAlertCount, totalLogsToday, openIncidentCount);
        await cache.SetAsync(cacheKey, stats, CacheTtl, ct);

        return stats;
    }
}
