using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using StackSift.Application.Common;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Application.Mapping;
using StackSift.Domain;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;

namespace StackSift.Application.Commands.Members;

public record AddOrInviteMemberCommand(
    Guid OrgId,
    string Email,
    UserRole Role) : IRequest<AddOrInviteMemberResult>;

public record AddOrInviteMemberResult(MemberDto? Member, InvitationDto? Invitation)
{
    public static AddOrInviteMemberResult Attached(MemberDto member) => new(member, null);
    public static AddOrInviteMemberResult Invited(InvitationDto invitation) => new(null, invitation);
}

public sealed class AddOrInviteMemberCommandValidator : AbstractValidator<AddOrInviteMemberCommand>
{
    public AddOrInviteMemberCommandValidator()
    {
        RuleFor(c => c.OrgId).NotEqual(Guid.Empty);
        RuleFor(c => c.Email).NotEmpty().EmailAddress().MaximumLength(200);
        RuleFor(c => c.Role).IsInEnum();
    }
}

public sealed class AddOrInviteMemberCommandHandler(
    IUnitOfWork uow,
    IKeycloakAdminClient keycloak,
    IEmailService email,
    IMemberEmailComposer composer,
    ICurrentUserService currentUser,
    IAuditLog auditLog,
    ILogger<AddOrInviteMemberCommandHandler> logger)
    : IRequestHandler<AddOrInviteMemberCommand, AddOrInviteMemberResult>
{
    private static readonly TimeSpan InvitationLifetime = TimeSpan.FromDays(7);

    public async Task<AddOrInviteMemberResult> Handle(AddOrInviteMemberCommand cmd, CancellationToken ct)
    {
        if (cmd.OrgId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Organization), cmd.OrgId);

        var normalized = cmd.Email.Trim().ToLowerInvariant();

        var org = await uow.Organizations.GetByIdAsync(cmd.OrgId, ct)
            ?? throw new NotFoundException(nameof(Organization), cmd.OrgId);
        var inviter = await uow.Users.GetByIdAsync(currentUser.UserId, ct)
            ?? throw new NotFoundException(nameof(User), currentUser.UserId);

        var existing = await uow.Users.FindByEmailAsync(normalized, ct);
        if (existing is not null)
        {
            if (existing.OrganizationId == cmd.OrgId)
                throw new ConflictException("User is already a member of this organisation.");
            if (existing.OrganizationId is not null)
                throw new ConflictException("User already belongs to another organisation.");

            await EnforceUserCapAsync(org, ct);
            return await AttachExistingUserAsync(existing, cmd.Role, org.Name, ct);
        }

        var existingPending = await uow.Invitations.FindPendingByEmailAsync(normalized, ct);
        if (existingPending is null)
            await EnforceUserCapAsync(org, ct);

        return await UpsertInvitationAsync(normalized, cmd, inviter, org, existingPending, ct);
    }

    private async Task<AddOrInviteMemberResult> AttachExistingUserAsync(
        User user, UserRole role, string orgName, CancellationToken ct)
    {
        var prevOrg = user.OrganizationId;
        var prevRole = user.Role;
        var prevInvitedBy = user.InvitedByUserId;

        user.OrganizationId = currentUser.OrganizationId;
        user.Role = role;
        user.InvitedByUserId = currentUser.UserId;
        await uow.Users.UpdateAsync(user, ct);
        await uow.SaveChangesAsync(ct);

        try
        {
            await keycloak.SetUserAttributesAsync(
                user.Id, role.ToString().ToLowerInvariant(), user.OrganizationId, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Keycloak update failed after DB attach for {UserId}; rolling back DB row",
                user.Id);
            user.OrganizationId = prevOrg;
            user.Role = prevRole;
            user.InvitedByUserId = prevInvitedBy;
            await uow.Users.UpdateAsync(user, ct);
            await uow.SaveChangesAsync(CancellationToken.None);
            throw;
        }

        try
        {
            await email.SendAsync(composer.BuildMemberAdded(user.Email, orgName, role), ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Failed to send member-added notification to {Email}; attach committed",
                user.Email);
        }

        logger.LogInformation(
            "Attached existing user {UserId} ({Email}) to org {OrgId} as {Role}",
            user.Id, user.Email, currentUser.OrganizationId, role);

        await auditLog.WriteAsync(AuditEvent.MemberInvited, currentUser.OrganizationId, null, null,
            user.Id, nameof(User), $"attached:{role}", ct);

        return AddOrInviteMemberResult.Attached(user.ToMemberDto());
    }

    private async Task EnforceUserCapAsync(Organization org, CancellationToken ct)
    {
        var limit = PlanLimits.Map[org.Plan];
        if (limit.MaxUsers == int.MaxValue) return;
        var active = await uow.Users.CountActiveMembersAsync(org.Id, ct);
        var pending = await uow.Invitations.CountPendingByOrgAsync(org.Id, ct);
        if (active + pending >= limit.MaxUsers)
        {
            logger.LogInformation(
                "Plan-limit gate: org {OrgId} at cap ({Used}/{Max}); rejecting add-or-invite",
                org.Id, active + pending, limit.MaxUsers);
            throw new PlanLimitExceededException("members", limit.MaxUsers, org.Plan);
        }
    }

    private async Task<AddOrInviteMemberResult> UpsertInvitationAsync(
        string normalizedEmail,
        AddOrInviteMemberCommand cmd,
        User inviter,
        Organization org,
        Invitation? existingPending,
        CancellationToken ct)
    {
        Invitation invitation;
        if (existingPending is not null)
        {
            existingPending.OrganizationId = cmd.OrgId;
            existingPending.Role = cmd.Role;
            existingPending.InvitedByUserId = currentUser.UserId;
            existingPending.Token = TokenGenerator.UrlSafe();
            existingPending.ExpiresAt = DateTimeOffset.UtcNow.Add(InvitationLifetime);
            await uow.Invitations.UpdateAsync(existingPending, ct);
            invitation = existingPending;
        }
        else
        {
            invitation = new Invitation
            {
                Id = Guid.NewGuid(),
                OrganizationId = cmd.OrgId,
                Email = normalizedEmail,
                Role = cmd.Role,
                InvitedByUserId = currentUser.UserId,
                Token = TokenGenerator.UrlSafe(),
                ExpiresAt = DateTimeOffset.UtcNow.Add(InvitationLifetime),
            };
            await uow.Invitations.AddAsync(invitation, ct);
        }
        await uow.SaveChangesAsync(ct);

        try
        {
            await email.SendAsync(
                composer.BuildInvitation(
                    invitation.Email, inviter.DisplayName, org.Name,
                    invitation.Role, invitation.Token, invitation.ExpiresAt),
                ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Failed to send invitation email to {Email}; invitation row created",
                invitation.Email);
        }

        logger.LogInformation(
            "Invitation {InvitationId} created for {Email} to org {OrgId} as {Role}",
            invitation.Id, invitation.Email, cmd.OrgId, cmd.Role);

        await auditLog.WriteAsync(AuditEvent.MemberInvited, cmd.OrgId, null, null,
            invitation.Id, nameof(Invitation), $"invited:{cmd.Role}", ct);

        return AddOrInviteMemberResult.Invited(invitation.ToDto());
    }
}
