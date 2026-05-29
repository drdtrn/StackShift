using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;

namespace StackSift.Application.Commands.Gdpr;

public sealed record RequestAccountExportCommand : IRequest<AccountExportRequestDto>;

public sealed class RequestAccountExportCommandHandler(
    IAccountExportContext context,
    ICurrentUserService currentUser,
    IAuditLog auditLog,
    IAccountExportEnqueuer enqueuer)
    : IRequestHandler<RequestAccountExportCommand, AccountExportRequestDto>
{
    private static readonly TimeSpan RateLimitWindow = TimeSpan.FromDays(7);

    public async Task<AccountExportRequestDto> Handle(RequestAccountExportCommand request, CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated)
            throw new ForbiddenException("Authentication required to request an account export.");

        var userId = currentUser.UserId;

        var pending = await context.GetPendingForUserAsync(userId, ct);
        if (pending is not null)
            return ToDto(pending);

        var windowStart = DateTimeOffset.UtcNow - RateLimitWindow;
        var recentReady = await context.GetMostRecentReadyForUserAsync(userId, windowStart, ct);
        if (recentReady is not null)
        {
            var nextAvailable = recentReady.RequestedAt + RateLimitWindow;
            throw new ConflictException(
                $"An export was generated within the last 7 days. Next request available after {nextAvailable:O}.");
        }

        var entity = new AccountExportRequest
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Status = AccountExportStatus.Pending,
            RequestedAt = DateTimeOffset.UtcNow,
        };
        await context.AddAsync(entity, ct);
        await context.SaveChangesAsync(ct);

        await auditLog.WriteAsync(
            AuditEvent.DataExportRequested,
            currentUser.OrganizationId,
            projectId: null,
            logSourceId: null,
            targetId: entity.Id,
            targetType: nameof(AccountExportRequest),
            details: null,
            ct);

        enqueuer.Enqueue(entity.Id);

        return ToDto(entity);
    }

    private static AccountExportRequestDto ToDto(AccountExportRequest e) => new(
        RequestId: e.Id,
        Status: e.Status,
        RequestedAt: e.RequestedAt,
        CompletedAt: e.CompletedAt,
        ExpiresAt: e.ExpiresAt,
        SignedUrl: e.SignedUrl,
        SizeBytes: e.SizeBytes,
        ManifestSha256: e.ManifestSha256);
}
