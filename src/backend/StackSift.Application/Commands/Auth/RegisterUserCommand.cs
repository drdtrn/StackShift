using MediatR;
using Microsoft.Extensions.Logging;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces;

namespace StackSift.Application.Commands.Auth;

public record RegisterUserCommand(
    string Email,
    string Password,
    string DisplayName,
    bool IsOwner) : IRequest<RegisterUserResult>;

public record RegisterUserResult(
    Guid UserId,
    string Email,
    string Role,
    Guid? OrganizationId,
    bool AttachedViaInvitation);

public sealed class RegisterUserCommandHandler(
    IKeycloakAdminClient keycloak,
    IUnitOfWork uow,
    ILogger<RegisterUserCommandHandler> logger)
    : IRequestHandler<RegisterUserCommand, RegisterUserResult>
{
    public async Task<RegisterUserResult> Handle(RegisterUserCommand cmd, CancellationToken ct)
    {
        var normalized = cmd.Email.Trim().ToLowerInvariant();

        var pending = await uow.Invitations.FindPendingByEmailAsync(normalized, ct);
        var role = pending?.Role ?? (cmd.IsOwner ? UserRole.Owner : UserRole.Viewer);
        var orgId = pending?.OrganizationId;
        var roleSlug = role.ToString().ToLowerInvariant();

        var keycloakUserId = await keycloak.CreateUserAsync(
            normalized, cmd.Password, cmd.DisplayName, roleSlug, orgId, ct);

        try
        {
            var user = new User
            {
                Id = keycloakUserId,
                Email = normalized,
                DisplayName = cmd.DisplayName,
                Role = role,
                OrganizationId = orgId,
                InvitedByUserId = pending?.InvitedByUserId,
            };
            await uow.Users.AddAsync(user, ct);

            if (pending is not null)
            {
                pending.AcceptedAt = DateTimeOffset.UtcNow;
                await uow.Invitations.UpdateAsync(pending, ct);
            }

            await uow.SaveChangesAsync(ct);

            if (pending is not null)
            {
                logger.LogInformation(
                    "Registered user {UserId} auto-attached to org {OrgId} via invitation {InvId}",
                    user.Id, orgId, pending.Id);
            }
            else
            {
                logger.LogInformation(
                    "Registered user {UserId} ({Email}) as {Role}",
                    user.Id, user.Email, roleSlug);
            }

            return new RegisterUserResult(
                user.Id, user.Email, roleSlug, user.OrganizationId,
                AttachedViaInvitation: pending is not null);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "DB insert failed after Keycloak user creation. Rolling back Keycloak user {UserId}",
                keycloakUserId);

            try
            {
                await keycloak.DeleteUserAsync(keycloakUserId, CancellationToken.None);
            }
            catch (Exception deleteEx)
            {
                logger.LogError(deleteEx,
                    "Compensating Keycloak delete failed for {UserId}; user is now orphaned",
                    keycloakUserId);
            }

            throw;
        }
    }
}
