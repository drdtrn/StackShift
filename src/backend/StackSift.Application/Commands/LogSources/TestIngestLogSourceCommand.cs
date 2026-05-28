using FluentValidation;
using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Application.Messages;
using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.LogSources;

public record TestIngestLogSourceCommand(Guid Id) : IRequest<TestIngestResultDto>;

public class TestIngestLogSourceCommandValidator : AbstractValidator<TestIngestLogSourceCommand>
{
    public TestIngestLogSourceCommandValidator()
    {
        RuleFor(x => x.Id).NotEqual(Guid.Empty);
    }
}

public class TestIngestLogSourceCommandHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser,
    IMessagePublisher publisher,
    IAuditLog auditLog)
    : IRequestHandler<TestIngestLogSourceCommand, TestIngestResultDto>
{
    public async Task<TestIngestResultDto> Handle(TestIngestLogSourceCommand request, CancellationToken ct)
    {
        var logSource = await uow.LogSources.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(LogSource), request.Id);

        if (logSource.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(LogSource), request.Id);

        var syntheticId = Guid.NewGuid();
        var sentAt = DateTimeOffset.UtcNow;
        var entry = new IngestLogEntryDto(
            LogLevel.Info,
            $"StackSift synthetic test event for {logSource.Name}",
            sentAt,
            syntheticId.ToString(),
            null,
            "stacksift-test",
            Environment.MachineName,
            new Dictionary<string, object?> { ["synthetic"] = true, ["syntheticId"] = syntheticId.ToString() });

        await publisher.PublishAsync(new LogBatchMessage(
            currentUser.OrganizationId,
            logSource.ProjectId,
            logSource.Id,
            [entry],
            true), ct);

        await auditLog.WriteAsync(AuditEvent.LogSourceTestIngestSent, currentUser.OrganizationId,
            logSource.ProjectId, logSource.Id, logSource.Id, nameof(LogSource), syntheticId.ToString(), ct);
        await uow.SaveChangesAsync(ct);

        return new TestIngestResultDto(syntheticId, sentAt);
    }
}
