using FluentValidation;
using FluentValidation.Results;
using MediatR;
using StackSift.Application.DTOs;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.Incidents;

public record UpdateIncidentStatusCommand(Guid Id, IncidentStatus Status) : IRequest<IncidentDto>;

public class UpdateIncidentStatusCommandValidator : AbstractValidator<UpdateIncidentStatusCommand>
{
    public UpdateIncidentStatusCommandValidator()
    {
        RuleFor(x => x.Id).NotEqual(Guid.Empty);
    }
}

public class UpdateIncidentStatusCommandHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<UpdateIncidentStatusCommand, IncidentDto>
{
    public async Task<IncidentDto> Handle(UpdateIncidentStatusCommand request, CancellationToken ct)
    {
        var incident = await uow.Incidents.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(Incident), request.Id);

        if (incident.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Incident), request.Id);

        // Guard invalid state transitions (Resolved is a terminal state — cannot reopen)
        if (incident.Status == IncidentStatus.Resolved && request.Status != IncidentStatus.Closed)
            throw new ValidationException(
                [new ValidationFailure("status",
                    $"Cannot transition from {incident.Status} to {request.Status}. Resolved incidents can only be Closed.")]);

        incident.Status = request.Status;

        if (request.Status == IncidentStatus.Acknowledged)
            incident.AcknowledgedAt = DateTimeOffset.UtcNow;
        else if (request.Status == IncidentStatus.Resolved)
            incident.ResolvedAt = DateTimeOffset.UtcNow;
        else if (request.Status == IncidentStatus.Closed)
            incident.ClosedAt = DateTimeOffset.UtcNow;

        await uow.Incidents.UpdateAsync(incident, ct);
        await uow.SaveChangesAsync(ct);

        return incident.ToDto();
    }
}
