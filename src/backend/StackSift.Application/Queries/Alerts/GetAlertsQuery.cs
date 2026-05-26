using MediatR;
using StackSift.Application.Common;
using StackSift.Application.DTOs;

namespace StackSift.Application.Queries.Alerts;

public record GetAlertsQuery(int Page, int PageSize, Guid? ProjectId, Guid? IncidentId)
    : IRequest<PaginatedResponse<AlertDto>>;

public class GetAlertsQueryHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<GetAlertsQuery, PaginatedResponse<AlertDto>>
{
    public async Task<PaginatedResponse<AlertDto>> Handle(GetAlertsQuery request, CancellationToken ct)
    {
        IList<Alert> items;

        if (request.IncidentId.HasValue)
        {
            var incident = await uow.Incidents.GetByIdAsync(request.IncidentId.Value, ct)
                ?? throw new NotFoundException(nameof(Incident), request.IncidentId.Value);

            if (incident.OrganizationId != currentUser.OrganizationId)
                throw new NotFoundException(nameof(Incident), request.IncidentId.Value);

            items = await uow.Alerts.GetByIncidentIdAsync(
                request.IncidentId.Value, request.Page, request.PageSize, ct);
        }
        else if (request.ProjectId.HasValue)
        {
            items = await uow.Alerts.GetByProjectIdAsync(
                request.ProjectId.Value, request.Page, request.PageSize, ct);
        }
        else
        {
            items = await uow.Alerts.GetByOrganizationIdAsync(
                currentUser.OrganizationId, request.Page, request.PageSize, ct);
        }

        var dtos = items.Select(a => a.ToDto()).ToList();

        return new PaginatedResponse<AlertDto>(
            dtos,
            Total: dtos.Count,
            Page: request.Page,
            PageSize: request.PageSize,
            HasNextPage: dtos.Count == request.PageSize,
            HasPreviousPage: request.Page > 1
        );
    }
}
