using FluentValidation;
using MediatR;
using StackSift.Application.Interfaces;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.LogSources;

public record DeleteLogSourceCommand(Guid Id) : IRequest<Unit>;

public class DeleteLogSourceCommandValidator : AbstractValidator<DeleteLogSourceCommand>
{
    public DeleteLogSourceCommandValidator()
    {
        RuleFor(x => x.Id).NotEqual(Guid.Empty);
    }
}

public class DeleteLogSourceCommandHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser,
    IAuditLog auditLog)
    : IRequestHandler<DeleteLogSourceCommand, Unit>
{
    public async Task<Unit> Handle(DeleteLogSourceCommand request, CancellationToken ct)
    {
        var logSource = await uow.LogSources.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(LogSource), request.Id);

        if (logSource.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(LogSource), request.Id);

        logSource.IsActive = false;
        await uow.LogSources.UpdateAsync(logSource, ct);
        await uow.LogSources.DeleteAsync(logSource.Id, ct);
        await auditLog.WriteAsync(AuditEvent.LogSourceDeleted, currentUser.OrganizationId,
            logSource.ProjectId, logSource.Id, logSource.Id, nameof(LogSource), null, ct);
        await uow.SaveChangesAsync(ct);

        return Unit.Value;
    }
}
