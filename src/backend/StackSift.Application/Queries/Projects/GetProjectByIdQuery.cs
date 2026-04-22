using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Mapping;

namespace StackSift.Application.Queries.Projects;

public record GetProjectByIdQuery(Guid Id) : IRequest<ProjectDto>;

public class GetProjectByIdQueryHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<GetProjectByIdQuery, ProjectDto>
{
    public async Task<ProjectDto> Handle(GetProjectByIdQuery request, CancellationToken ct)
    {
        var project = await uow.Projects.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(Project), request.Id);

        if (project.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Project), request.Id);

        return project.ToDto();
    }
}
