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
    private const int MaxMessageLength = 64 * 1024;
    private const int MaxMetadataKeys = 50;
    private const int MaxMetadataValueLength = 8 * 1024;
    private const long MaxTotalBatchBytes = 10L * 1024 * 1024;

    public IngestLogBatchCommandValidator()
    {
        RuleFor(x => x.ProjectId).NotEqual(Guid.Empty);
        RuleFor(x => x.LogSourceId).NotEqual(Guid.Empty);
        RuleFor(x => x.Entries).NotEmpty();
        RuleFor(x => x.Entries.Count).LessThanOrEqualTo(1000)
            .WithMessage("Batch size cannot exceed 1000 entries.");

        RuleForEach(x => x.Entries).ChildRules(e =>
        {
            e.RuleFor(en => en.Message).NotEmpty().MaximumLength(MaxMessageLength);
            e.RuleFor(en => en.Level).IsInEnum();
            e.RuleFor(en => en.ServiceName).MaximumLength(200);
            e.RuleFor(en => en.HostName).MaximumLength(200);
            e.RuleFor(en => en.TraceId).MaximumLength(128);
            e.RuleFor(en => en.SpanId).MaximumLength(64);
            e.RuleFor(en => en.Metadata)
                .Must(m => m is null || m.Count <= MaxMetadataKeys)
                .WithMessage($"Metadata may contain at most {MaxMetadataKeys} keys.");
            e.RuleFor(en => en.Metadata)
                .Must(m => m is null || m.All(kv => (kv.Value?.ToString()?.Length ?? 0) <= MaxMetadataValueLength))
                .WithMessage("A metadata value exceeds the maximum length.");
        });

        RuleFor(x => x.Entries)
            .Must(entries => entries.Sum(e => (long)(e.Message?.Length ?? 0)) <= MaxTotalBatchBytes)
            .WithMessage("Batch payload exceeds 10 MiB.");
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
