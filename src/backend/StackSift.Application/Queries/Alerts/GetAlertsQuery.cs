using MediatR;
using StackSift.Application.Common;
using StackSift.Application.DTOs;
using StackSift.Application.Mapping;

namespace StackSift.Application.Queries.Alerts;

public record GetAlertsQuery(int Page, int PageSize, Guid? ProjectId) : IRequest<PaginatedResponse<AlertDto>>;

public class GetAlertsQueryHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<GetAlertsQuery, PaginatedResponse<AlertDto>>
{
    public async Task<PaginatedResponse<AlertDto>> Handle(GetAlertsQuery request, CancellationToken ct)
    {
        var projectId = request.ProjectId ?? currentUser.OrganizationId;

        var items = await uow.Alerts.GetByProjectIdAsync(
            projectId, request.Page, request.PageSize, ct);

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
