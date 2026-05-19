using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Mapping;
using StackSift.Domain.Entities;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;

namespace StackSift.Application.Queries.LogSources;

public record GetLogSourcesQuery(Guid ProjectId) : IRequest<List<LogSourceDto>>;

public class GetLogSourcesQueryHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<GetLogSourcesQuery, List<LogSourceDto>>
{
    public async Task<List<LogSourceDto>> Handle(GetLogSourcesQuery request, CancellationToken ct)
    {
        var project = await uow.Projects.GetByIdAsync(request.ProjectId, ct)
            ?? throw new NotFoundException(nameof(Project), request.ProjectId);

        if (project.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        var sources = await uow.LogSources.GetByProjectIdAsync(request.ProjectId, ct);

        return sources.Select(ls => ls.ToDto()).ToList();
    }
}
