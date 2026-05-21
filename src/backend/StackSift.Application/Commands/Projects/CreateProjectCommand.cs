using FluentValidation;
using MediatR;
using StackSift.Application.DTOs;
using StackSift.Domain;
using StackSift.Domain.Entities;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.Projects;

public record CreateProjectCommand(string Name, string? Description, string Color) : IRequest<ProjectDto>;

public class CreateProjectCommandValidator : AbstractValidator<CreateProjectCommand>
{
    public CreateProjectCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().Length(2, 100);
        RuleFor(x => x.Color).NotEmpty().Matches(@"^#[0-9A-Fa-f]{6}$");
    }
}

public class CreateProjectCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<CreateProjectCommand, ProjectDto>
{
    public async Task<ProjectDto> Handle(CreateProjectCommand request, CancellationToken ct)
    {
        var org = await uow.Organizations.GetByIdAsync(currentUser.OrganizationId, ct);
        if (org is not null)
        {
            var limit = PlanLimits.Map[org.Plan];
            if (limit.MaxProjects != int.MaxValue)
            {
                var active = await uow.Projects.GetActiveCountByOrganizationIdAsync(currentUser.OrganizationId, ct);
                if (active >= limit.MaxProjects)
                    throw new PlanLimitExceededException("projects", limit.MaxProjects, org.Plan);
            }
        }

        var slug = request.Name.ToLowerInvariant().Replace(" ", "-");

        if (await uow.Projects.SlugExistsInOrgAsync(slug, currentUser.OrganizationId, ct))
            throw new ConflictException($"A project with slug '{slug}' already exists in this organisation.");

        var project = new Project
        {
            Id = Guid.NewGuid(),
            OrganizationId = currentUser.OrganizationId,
            Name = request.Name,
            Slug = slug,
            Description = request.Description,
            Color = request.Color
        };

        await uow.Projects.AddAsync(project, ct);
        await uow.SaveChangesAsync(ct);

        return project.ToDto();
    }
}
