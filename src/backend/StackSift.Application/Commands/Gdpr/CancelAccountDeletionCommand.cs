using MediatR;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.Gdpr;

public sealed record CancelAccountDeletionCommand(string Token) : IRequest<CancelAccountDeletionResultDto>;

public sealed record CancelAccountDeletionResultDto(Guid RequestId, Guid UserId);

public sealed class CancelAccountDeletionCommandHandler(
    IAccountErasureContext erasures,
    IUserRepository users,
    IAccountErasureService erasureService,
    IErasureCancellationTokenHasher tokenHasher,
    TimeProvider time)
    : IRequestHandler<CancelAccountDeletionCommand, CancelAccountDeletionResultDto>
{
    public async Task<CancelAccountDeletionResultDto> Handle(
        CancelAccountDeletionCommand request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            throw new ConflictException("token_required");

        var hash = tokenHasher.Hash(request.Token);
        var row = await erasures.FindByCancellationHashAsync(hash, ct)
            ?? throw new NotFoundException(nameof(AccountErasureRequest), Guid.Empty);

        if (time.GetUtcNow() > row.GraceEndsAt)
            throw new ConflictException("grace_window_expired");

        var user = await users.GetByIdAsync(row.UserId, ct)
            ?? throw new NotFoundException(nameof(User), row.UserId);

        row.Status = AccountErasureStatus.Cancelled;
        row.CompletedAt = time.GetUtcNow();
        // Burn the token on use — even within grace it must not double-cancel.
        row.CancellationTokenHash = null;

        user.IsDeleted = false;
        user.DeletedAt = null;

        await erasures.SaveChangesAsync(ct);

        try
        {
            await erasureService.EnableKeycloakUserAsync(row.UserId, ct);
        }
        catch
        {
            // Same logging convention as RequestAccountDeletionCommand — if
            // Keycloak is briefly unreachable, the user can complete the
            // restore via a subsequent /account/restore?token= retry.
        }

        return new CancelAccountDeletionResultDto(row.Id, row.UserId);
    }
}
