using MediatR;
using StackSift.Application.Common;
using StackSift.Application.DTOs;
using StackSift.Application.Mapping;

namespace StackSift.Application.Queries.Projects;

public record GetProjectsQuery(int Page, int PageSize) : IRequest<PaginatedResponse<ProjectDto>>;

public class GetProjectsQueryHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<GetProjectsQuery, PaginatedResponse<ProjectDto>>
{
    public async Task<PaginatedResponse<ProjectDto>> Handle(GetProjectsQuery request, CancellationToken ct)
    {
        var items = await uow.Projects.GetByOrganizationIdAsync(
            currentUser.OrganizationId, request.Page, request.PageSize, ct);

        var dtos = items.Select(p => p.ToDto()).ToList();

        return new PaginatedResponse<ProjectDto>(
            dtos,
            Total: dtos.Count,
            Page: request.Page,
            PageSize: request.PageSize,
            HasNextPage: dtos.Count == request.PageSize,
            HasPreviousPage: request.Page > 1
        );
    }
}
