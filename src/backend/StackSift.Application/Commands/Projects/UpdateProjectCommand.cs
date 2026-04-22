using FluentValidation;
using MediatR;
using StackSift.Application.DTOs;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.Projects;

public record UpdateProjectCommand(Guid Id, string Name, string? Description, string Color) : IRequest<ProjectDto>;

public class UpdateProjectCommandValidator : AbstractValidator<UpdateProjectCommand>
{
    public UpdateProjectCommandValidator()
    {
        RuleFor(x => x.Id).NotEqual(Guid.Empty);
        RuleFor(x => x.Name).NotEmpty().Length(2, 100);
        RuleFor(x => x.Color).NotEmpty().Matches(@"^#[0-9A-Fa-f]{6}$");
    }
}

public class UpdateProjectCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<UpdateProjectCommand, ProjectDto>
{
    public async Task<ProjectDto> Handle(UpdateProjectCommand request, CancellationToken ct)
    {
        var project = await uow.Projects.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(Project), request.Id);

        if (project.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Project), request.Id);

        project.Name = request.Name;
        project.Slug = request.Name.ToLowerInvariant().Replace(" ", "-");
        project.Description = request.Description;
        project.Color = request.Color;

        await uow.Projects.UpdateAsync(project, ct);
        await uow.SaveChangesAsync(ct);

        return project.ToDto();
    }
}
