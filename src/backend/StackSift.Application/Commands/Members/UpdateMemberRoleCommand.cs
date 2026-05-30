using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Application.Mapping;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;

namespace StackSift.Application.Commands.Members;

public record UpdateMemberRoleCommand(
    Guid OrgId,
    Guid UserId,
    UserRole NewRole) : IRequest<MemberDto>;

public sealed class UpdateMemberRoleCommandValidator : AbstractValidator<UpdateMemberRoleCommand>
{
    public UpdateMemberRoleCommandValidator()
    {
        RuleFor(c => c.OrgId).NotEqual(Guid.Empty);
        RuleFor(c => c.UserId).NotEqual(Guid.Empty);
        RuleFor(c => c.NewRole).IsInEnum();
    }
}

public sealed class UpdateMemberRoleCommandHandler(
    IUnitOfWork uow,
    IKeycloakAdminClient keycloak,
    ICurrentUserService currentUser,
    IAuditLog auditLog,
    ILogger<UpdateMemberRoleCommandHandler> logger)
    : IRequestHandler<UpdateMemberRoleCommand, MemberDto>
{
    public async Task<MemberDto> Handle(UpdateMemberRoleCommand cmd, CancellationToken ct)
    {
        if (cmd.OrgId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Organization), cmd.OrgId);

        var target = await uow.Users.GetByIdAsync(cmd.UserId, ct)
            ?? throw new NotFoundException(nameof(User), cmd.UserId);

        if (target.OrganizationId != cmd.OrgId)
            throw new NotFoundException(nameof(User), cmd.UserId);

        if (target.Role == cmd.NewRole)
            return target.ToMemberDto();

        if (target.Role == UserRole.Owner && cmd.NewRole != UserRole.Owner)
        {
            var ownerCount = await uow.Users.CountOwnersAsync(cmd.OrgId, ct);
            if (ownerCount <= 1)
                throw new ConflictException(
                    "Cannot remove or demote the last owner of an organisation.");
        }

        var prevRole = target.Role;
        target.Role = cmd.NewRole;
        await uow.Users.UpdateAsync(target, ct);
        await uow.SaveChangesAsync(ct);

        try
        {
            await keycloak.SetUserAttributesAsync(
                target.Id, cmd.NewRole.ToString().ToLowerInvariant(), target.OrganizationId, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Keycloak update failed after role change for {UserId}; rolling back DB",
                target.Id);
            target.Role = prevRole;
            await uow.Users.UpdateAsync(target, ct);
            await uow.SaveChangesAsync(CancellationToken.None);
            throw;
        }

        logger.LogInformation(
            "Updated role for {UserId} in org {OrgId}: {PrevRole} → {NewRole}",
            target.Id, cmd.OrgId, prevRole, cmd.NewRole);

        await auditLog.WriteAsync(AuditEvent.MemberRoleChanged, cmd.OrgId, null, null,
            target.Id, nameof(User), $"{prevRole}->{cmd.NewRole}", ct);

        return target.ToMemberDto();
    }
}
