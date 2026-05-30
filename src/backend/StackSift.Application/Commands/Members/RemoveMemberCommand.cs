using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;

namespace StackSift.Application.Commands.Members;

public record RemoveMemberCommand(Guid OrgId, Guid UserId) : IRequest<Unit>;

public sealed class RemoveMemberCommandValidator : AbstractValidator<RemoveMemberCommand>
{
    public RemoveMemberCommandValidator()
    {
        RuleFor(c => c.OrgId).NotEqual(Guid.Empty);
        RuleFor(c => c.UserId).NotEqual(Guid.Empty);
    }
}

public sealed class RemoveMemberCommandHandler(
    IUnitOfWork uow,
    IKeycloakAdminClient keycloak,
    ICurrentUserService currentUser,
    IAuditLog auditLog,
    ILogger<RemoveMemberCommandHandler> logger)
    : IRequestHandler<RemoveMemberCommand, Unit>
{
    public async Task<Unit> Handle(RemoveMemberCommand cmd, CancellationToken ct)
    {
        if (cmd.OrgId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Organization), cmd.OrgId);

        var target = await uow.Users.GetByIdAsync(cmd.UserId, ct)
            ?? throw new NotFoundException(nameof(User), cmd.UserId);

        if (target.OrganizationId != cmd.OrgId)
            throw new NotFoundException(nameof(User), cmd.UserId);

        if (target.Role == UserRole.Owner)
        {
            var ownerCount = await uow.Users.CountOwnersAsync(cmd.OrgId, ct);
            if (ownerCount <= 1)
                throw new ConflictException(
                    "Cannot remove or demote the last owner of an organisation.");
        }

        var prevOrg = target.OrganizationId;
        var prevRole = target.Role;
        var prevInvitedBy = target.InvitedByUserId;

        target.OrganizationId = null;
        target.Role = UserRole.Viewer;
        target.InvitedByUserId = null;
        await uow.Users.UpdateAsync(target, ct);
        await uow.SaveChangesAsync(ct);

        try
        {
            await keycloak.SetUserAttributesAsync(
                target.Id, UserRole.Viewer.ToString().ToLowerInvariant(), null, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Keycloak update failed after removing {UserId} from org {OrgId}; rolling back DB",
                target.Id, cmd.OrgId);
            target.OrganizationId = prevOrg;
            target.Role = prevRole;
            target.InvitedByUserId = prevInvitedBy;
            await uow.Users.UpdateAsync(target, ct);
            await uow.SaveChangesAsync(CancellationToken.None);
            throw;
        }

        logger.LogInformation(
            "Removed user {UserId} from org {OrgId} (kept account; now viewer/no-org)",
            target.Id, cmd.OrgId);

        await auditLog.WriteAsync(AuditEvent.MemberRemoved, cmd.OrgId, null, null,
            target.Id, nameof(User), null, ct);

        return Unit.Value;
    }
}
