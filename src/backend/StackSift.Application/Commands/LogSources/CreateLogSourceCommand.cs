using FluentValidation;
using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.LogSources;

public record CreateLogSourceCommand(Guid ProjectId, string Name, LogSourceType Type) : IRequest<LogSourceCreatedDto>;

public class CreateLogSourceCommandValidator : AbstractValidator<CreateLogSourceCommand>
{
    public CreateLogSourceCommandValidator()
    {
        RuleFor(x => x.ProjectId).NotEqual(Guid.Empty);
        RuleFor(x => x.Name).NotEmpty().Length(2, 100);
    }
}

public class CreateLogSourceCommandHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser,
    IApiKeyHasher apiKeyHasher,
    IAuditLog auditLog)
    : IRequestHandler<CreateLogSourceCommand, LogSourceCreatedDto>
{
    public async Task<LogSourceCreatedDto> Handle(CreateLogSourceCommand request, CancellationToken ct)
    {
        var project = await uow.Projects.GetByIdAsync(request.ProjectId, ct)
            ?? throw new NotFoundException(nameof(Project), request.ProjectId);

        if (project.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        var apiKey = apiKeyHasher.Generate();
        var logSource = new LogSource
        {
            Id = Guid.NewGuid(),
            ProjectId = request.ProjectId,
            OrganizationId = currentUser.OrganizationId,
            Name = request.Name,
            Type = request.Type,
            IngestUrl = "/api/v1/logs/ingest",
            KeyHash = apiKeyHasher.Hash(apiKey),
            KeyPrefix = apiKey[..8],
            IsActive = true
        };

        await uow.LogSources.AddAsync(logSource, ct);
        await auditLog.WriteAsync(AuditEvent.LogSourceKeyCreated, currentUser.OrganizationId,
            project.Id, logSource.Id, logSource.Id, nameof(LogSource), null, ct);
        await auditLog.WriteAsync(AuditEvent.LogSourceKeyRevealed, currentUser.OrganizationId,
            project.Id, logSource.Id, logSource.Id, nameof(LogSource), null, ct);
        await uow.SaveChangesAsync(ct);

        return new LogSourceCreatedDto(logSource.ToDto(), apiKey);
    }
}
