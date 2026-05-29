using MediatR;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.Gdpr;

public sealed record RequestAccountDeletionCommand(string Confirmation) : IRequest<AccountDeletionAcceptedDto>;

public sealed record AccountDeletionAcceptedDto(
    Guid RequestId,
    DateTimeOffset GracePeriodEndsAt,
    string CancellationToken);

public sealed class RequestAccountDeletionCommandHandler(
    IAccountErasureContext erasures,
    IUserRepository users,
    ICurrentUserService currentUser,
    IAccountErasureService erasureService,
    IErasureCancellationTokenHasher tokenHasher,
    IAuditLog auditLog,
    TimeProvider time)
    : IRequestHandler<RequestAccountDeletionCommand, AccountDeletionAcceptedDto>
{
    public const string RequiredConfirmation = "DELETE my account";
    public static readonly TimeSpan GraceWindow = TimeSpan.FromDays(30);

    public async Task<AccountDeletionAcceptedDto> Handle(
        RequestAccountDeletionCommand request, CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated)
            throw new ForbiddenException("Authentication required to delete an account.");

        if (request.Confirmation != RequiredConfirmation)
            throw new ConflictException(
                $"Confirmation string must be exactly '{RequiredConfirmation}'.");

        var userId = currentUser.UserId;

        var existing = await erasures.GetActiveForUserAsync(userId, ct);
        if (existing is not null)
            throw new ConflictException(
                $"Account deletion is already pending (grace ends {existing.GraceEndsAt:O}).");

        var user = await users.GetByIdAsync(userId, ct)
            ?? throw new NotFoundException(nameof(User), userId);

        var now = time.GetUtcNow();
        var token = tokenHasher.Generate();

        var entity = new AccountErasureRequest
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Status = AccountErasureStatus.PendingGrace,
            RequestedAt = now,
            GraceEndsAt = now + GraceWindow,
            CancellationTokenHash = tokenHasher.Hash(token),
        };
        await erasures.AddAsync(entity, ct);

        // Soft-delete the user immediately so they cannot sign back in and so
        // every downstream API call sees them as deleted. The AuditableEntity
        // override in AppDbContext also sets DeletedAt for us on EntityState.Deleted,
        // but here we want soft delete *without* removing from the DbSet — so we
        // set the fields directly.
        user.IsDeleted = true;
        user.DeletedAt = now;

        await erasures.SaveChangesAsync(ct);

        // External system effects after the row is persisted so a failure here
        // does not orphan the request. Keycloak disable is idempotent; we
        // accept a noisy log entry if the upstream is briefly unreachable.
        try
        {
            await erasureService.DisableKeycloakUserAsync(userId, ct);
        }
        catch
        {
            // Logged inside the service; deliberately swallow so the command
            // still completes — the AccountErasureJob will retry the disable
            // when it runs the hard-delete sweep.
        }

        await auditLog.WriteAsync(
            AuditEvent.DataErasureRequested,
            currentUser.OrganizationId,
            projectId: null,
            logSourceId: null,
            targetId: entity.Id,
            targetType: nameof(AccountErasureRequest),
            details: $"grace_ends={entity.GraceEndsAt:O}",
            ct);

        return new AccountDeletionAcceptedDto(
            RequestId: entity.Id,
            GracePeriodEndsAt: entity.GraceEndsAt,
            CancellationToken: token);
    }
}
