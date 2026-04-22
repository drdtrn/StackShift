using FluentValidation;
using MediatR;
using StackSift.Application.DTOs;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.Alerts;

public record AcknowledgeAlertCommand(Guid Id) : IRequest<AlertDto>;

public class AcknowledgeAlertCommandValidator : AbstractValidator<AcknowledgeAlertCommand>
{
    public AcknowledgeAlertCommandValidator()
    {
        RuleFor(x => x.Id).NotEqual(Guid.Empty);
    }
}

public class AcknowledgeAlertCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<AcknowledgeAlertCommand, AlertDto>
{
    public async Task<AlertDto> Handle(AcknowledgeAlertCommand request, CancellationToken ct)
    {
        var alert = await uow.Alerts.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(Alert), request.Id);

        if (alert.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Alert), request.Id);

        alert.AcknowledgedAt = DateTimeOffset.UtcNow;

        await uow.Alerts.UpdateAsync(alert, ct);
        await uow.SaveChangesAsync(ct);

        return alert.ToDto();
    }
}
