using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using StackSift.Application.Interfaces;
using StackSift.Domain;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;

namespace StackSift.Application.Commands.Auth;

public record AcceptInvitationCommand(
    string Token,
    string Password,
    string DisplayName) : IRequest<AcceptInvitationResult>;

public record AcceptInvitationResult(
    Guid UserId,
    string Email,
    Guid OrganizationId,
    UserRole Role);

public sealed class AcceptInvitationCommandValidator : AbstractValidator<AcceptInvitationCommand>
{
    public AcceptInvitationCommandValidator()
    {
        RuleFor(c => c.Token).NotEmpty();
        RuleFor(c => c.Password)
            .NotEmpty()
            .MinimumLength(12).WithMessage("Must be at least 12 characters.")
            .Matches(@"[A-Z]").WithMessage("Must contain an uppercase letter.")
            .Matches(@"[a-z]").WithMessage("Must contain a lowercase letter.")
            .Matches(@"\d").WithMessage("Must contain a digit.");
        RuleFor(c => c.DisplayName)
            .NotEmpty()
            .MinimumLength(2)
            .MaximumLength(80);
    }
}

public sealed class AcceptInvitationCommandHandler(
    IKeycloakAdminClient keycloak,
    IUnitOfWork uow,
    ILogger<AcceptInvitationCommandHandler> logger)
    : IRequestHandler<AcceptInvitationCommand, AcceptInvitationResult>
{
    public async Task<AcceptInvitationResult> Handle(AcceptInvitationCommand cmd, CancellationToken ct)
    {
        var invitation = await uow.Invitations.FindByTokenAsync(cmd.Token, ct)
            ?? throw new ConflictException("Invitation is invalid or has already been used.");

        if (invitation.AcceptedAt is not null)
            throw new ConflictException("Invitation has already been used.");

        if (invitation.ExpiresAt <= DateTimeOffset.UtcNow)
            throw new ConflictException("Invitation has expired.");

        var org = await uow.Organizations.GetByIdAsync(invitation.OrganizationId, ct)
            ?? throw new NotFoundException(nameof(Organization), invitation.OrganizationId);
        var planLimit = PlanLimits.Map[org.Plan];
        if (planLimit.MaxUsers != int.MaxValue)
        {
            var active = await uow.Users.CountActiveMembersAsync(org.Id, ct);
            var pending = await uow.Invitations.CountPendingByOrgAsync(org.Id, ct);
            if (active + pending - 1 >= planLimit.MaxUsers)
                throw new PlanLimitExceededException("members", planLimit.MaxUsers, org.Plan);
        }

        var roleSlug = invitation.Role.ToString().ToLowerInvariant();
        // Accepting via the emailed invitation token proves the invitee controls the
        // address, so create them already-verified — no second confirmation round-trip.
        var keycloakUserId = await keycloak.CreateUserAsync(
            invitation.Email, cmd.Password, cmd.DisplayName,
            roleSlug, invitation.OrganizationId, emailVerified: true, ct);

        try
        {
            var user = new User
            {
                Id = keycloakUserId,
                Email = invitation.Email,
                DisplayName = cmd.DisplayName,
                Role = invitation.Role,
                OrganizationId = invitation.OrganizationId,
                InvitedByUserId = invitation.InvitedByUserId,
            };
            await uow.Users.AddAsync(user, ct);

            invitation.AcceptedAt = DateTimeOffset.UtcNow;
            await uow.Invitations.UpdateAsync(invitation, ct);

            await uow.SaveChangesAsync(ct);

            logger.LogInformation(
                "User {UserId} accepted invitation {InvitationId} to org {OrgId} as {Role}",
                user.Id, invitation.Id, invitation.OrganizationId, invitation.Role);

            return new AcceptInvitationResult(
                user.Id, user.Email, invitation.OrganizationId, invitation.Role);
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
