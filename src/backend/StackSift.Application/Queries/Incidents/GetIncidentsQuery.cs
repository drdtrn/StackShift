using MediatR;
using StackSift.Application.Common;
using StackSift.Application.DTOs;
using StackSift.Application.Mapping;

namespace StackSift.Application.Queries.Incidents;

public record GetIncidentsQuery(int Page, int PageSize, IncidentStatus? Status, Guid? ProjectId)
    : IRequest<PaginatedResponse<IncidentDto>>;

public class GetIncidentsQueryHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<GetIncidentsQuery, PaginatedResponse<IncidentDto>>
{
    public async Task<PaginatedResponse<IncidentDto>> Handle(GetIncidentsQuery request, CancellationToken ct)
    {
        var projectId = request.ProjectId ?? currentUser.OrganizationId;

        var items = await uow.Incidents.GetByProjectIdAsync(
            projectId, request.Page, request.PageSize, request.Status, ct);

        var dtos = items.Select(i => i.ToDto()).ToList();

        return new PaginatedResponse<IncidentDto>(
            dtos,
            Total: dtos.Count,
            Page: request.Page,
            PageSize: request.PageSize,
            HasNextPage: dtos.Count == request.PageSize,
            HasPreviousPage: request.Page > 1
        );
    }
}
