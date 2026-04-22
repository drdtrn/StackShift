using FluentValidation;
using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Application.Messages;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.Logs;

public record IngestLogBatchCommand(
    Guid ProjectId,
    Guid LogSourceId,
    List<IngestLogEntryDto> Entries
) : IRequest<Unit>;

public class IngestLogBatchCommandValidator : AbstractValidator<IngestLogBatchCommand>
{
    public IngestLogBatchCommandValidator()
    {
        RuleFor(x => x.ProjectId).NotEqual(Guid.Empty);
        RuleFor(x => x.LogSourceId).NotEqual(Guid.Empty);
        RuleFor(x => x.Entries).NotEmpty();
        RuleFor(x => x.Entries.Count).LessThanOrEqualTo(1000)
            .WithMessage("Batch size cannot exceed 1000 entries.");
    }
}

public class IngestLogBatchCommandHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser,
    IMessagePublisher publisher)
    : IRequestHandler<IngestLogBatchCommand, Unit>
{
    public async Task<Unit> Handle(IngestLogBatchCommand request, CancellationToken ct)
    {
        var logSource = await uow.LogSources.GetByIdAsync(request.LogSourceId, ct)
            ?? throw new NotFoundException(nameof(LogSource), request.LogSourceId);

        if (logSource.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(LogSource), request.LogSourceId);

        var message = new LogBatchMessage(
            currentUser.OrganizationId,
            request.ProjectId,
            request.LogSourceId,
            request.Entries
        );

        await publisher.PublishAsync(message, ct);

        return Unit.Value;
    }
}
