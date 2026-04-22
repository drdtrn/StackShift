using FluentValidation;
using MediatR;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.Projects;

public record DeleteProjectCommand(Guid Id) : IRequest<Unit>;

public class DeleteProjectCommandValidator : AbstractValidator<DeleteProjectCommand>
{
    public DeleteProjectCommandValidator()
    {
        RuleFor(x => x.Id).NotEqual(Guid.Empty);
    }
}

public class DeleteProjectCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<DeleteProjectCommand, Unit>
{
    public async Task<Unit> Handle(DeleteProjectCommand request, CancellationToken ct)
    {
        var project = await uow.Projects.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(Project), request.Id);

        if (project.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Project), request.Id);

        await uow.Projects.DeleteAsync(request.Id, ct);
        await uow.SaveChangesAsync(ct);

        return Unit.Value;
    }
}
