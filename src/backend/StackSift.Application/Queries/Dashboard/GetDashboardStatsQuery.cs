using MediatR;
using StackSift.Application.DTOs;

namespace StackSift.Application.Queries.Dashboard;

public record GetDashboardStatsQuery : IRequest<DashboardStatsDto>;

public class GetDashboardStatsQueryHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<GetDashboardStatsQuery, DashboardStatsDto>
{
    public async Task<DashboardStatsDto> Handle(GetDashboardStatsQuery request, CancellationToken ct)
    {
        var orgId = currentUser.OrganizationId;

        var activeAlertCount = await uow.Alerts.GetActiveCountByOrganizationIdAsync(orgId, ct);
        var totalLogsToday = await uow.LogEntries.GetTotalTodayByOrganizationIdAsync(orgId, ct);
        var openIncidentCount = await uow.Incidents.GetOpenCountByOrganizationIdAsync(orgId, ct);

        return new DashboardStatsDto(activeAlertCount, totalLogsToday, openIncidentCount);
    }
}
