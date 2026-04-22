using FluentValidation;
using MediatR;
using StackSift.Application.DTOs;
using StackSift.Domain.Entities;
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
        var project = new Project
        {
            Id = Guid.NewGuid(),
            OrganizationId = currentUser.OrganizationId,
            Name = request.Name,
            Slug = request.Name.ToLowerInvariant().Replace(" ", "-"),
            Description = request.Description,
            Color = request.Color
        };

        await uow.Projects.AddAsync(project, ct);
        await uow.SaveChangesAsync(ct);

        return project.ToDto();
    }
}
