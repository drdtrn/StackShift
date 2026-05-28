using FluentValidation;
using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.LogSources;

public record RegenerateLogSourceKeyCommand(Guid Id) : IRequest<LogSourceCreatedDto>;

public class RegenerateLogSourceKeyCommandValidator : AbstractValidator<RegenerateLogSourceKeyCommand>
{
    public RegenerateLogSourceKeyCommandValidator()
    {
        RuleFor(x => x.Id).NotEqual(Guid.Empty);
    }
}

public class RegenerateLogSourceKeyCommandHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser,
    IApiKeyHasher apiKeyHasher,
    IAuditLog auditLog)
    : IRequestHandler<RegenerateLogSourceKeyCommand, LogSourceCreatedDto>
{
    public async Task<LogSourceCreatedDto> Handle(RegenerateLogSourceKeyCommand request, CancellationToken ct)
    {
        var logSource = await uow.LogSources.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(LogSource), request.Id);

        if (logSource.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(LogSource), request.Id);

        var apiKey = apiKeyHasher.Generate();
        logSource.KeyHash = apiKeyHasher.Hash(apiKey);
        logSource.KeyPrefix = apiKey[..8];
        logSource.KeyRotatedAt = DateTimeOffset.UtcNow;

        await uow.LogSources.UpdateAsync(logSource, ct);
        await auditLog.WriteAsync(AuditEvent.LogSourceKeyRegenerated, currentUser.OrganizationId,
            logSource.ProjectId, logSource.Id, logSource.Id, nameof(LogSource), null, ct);
        await auditLog.WriteAsync(AuditEvent.LogSourceKeyRevealed, currentUser.OrganizationId,
            logSource.ProjectId, logSource.Id, logSource.Id, nameof(LogSource), null, ct);
        await uow.SaveChangesAsync(ct);

        return new LogSourceCreatedDto(logSource.ToDto(), apiKey);
    }
}
