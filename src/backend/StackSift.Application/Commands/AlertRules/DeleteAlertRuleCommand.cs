using FluentValidation;
using MediatR;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.AlertRules;

public record DeleteAlertRuleCommand(Guid Id) : IRequest<Unit>;

public class DeleteAlertRuleCommandValidator : AbstractValidator<DeleteAlertRuleCommand>
{
    public DeleteAlertRuleCommandValidator()
    {
        RuleFor(x => x.Id).NotEqual(Guid.Empty);
    }
}

public class DeleteAlertRuleCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<DeleteAlertRuleCommand, Unit>
{
    public async Task<Unit> Handle(DeleteAlertRuleCommand request, CancellationToken ct)
    {
        var rule = await uow.AlertRules.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(AlertRule), request.Id);

        if (rule.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(AlertRule), request.Id);

        await uow.AlertRules.DeleteAsync(request.Id, ct);
        await uow.SaveChangesAsync(ct);

        return Unit.Value;
    }
}
