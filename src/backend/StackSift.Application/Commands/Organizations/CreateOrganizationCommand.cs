using System.Text.RegularExpressions;
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

namespace StackSift.Application.Commands.Organizations;

public record CreateOrganizationCommand(string Name) : IRequest<OrganizationDto>;

public sealed class CreateOrganizationCommandValidator : AbstractValidator<CreateOrganizationCommand>
{
    public CreateOrganizationCommandValidator()
    {
        RuleFor(c => c.Name)
            .NotEmpty()
            .MinimumLength(2)
            .MaximumLength(50)
            .Matches(@"^[a-zA-Z0-9][a-zA-Z0-9 \-]*$")
            .WithMessage(
                "Name must start with a letter or number and contain only letters, numbers, spaces, and hyphens.");
    }
}

public sealed class CreateOrganizationCommandHandler(
    IUnitOfWork uow,
    IKeycloakAdminClient keycloak,
    ICurrentUserService currentUser,
    ILogger<CreateOrganizationCommandHandler> logger)
    : IRequestHandler<CreateOrganizationCommand, OrganizationDto>
{
    public async Task<OrganizationDto> Handle(CreateOrganizationCommand cmd, CancellationToken ct)
    {
        if (currentUser.OrganizationId != Guid.Empty)
            throw new ConflictException("You already belong to an organisation.");

        var user = await uow.Users.GetByIdAsync(currentUser.UserId, ct)
            ?? throw new NotFoundException(nameof(User), currentUser.UserId);

        if (user.OrganizationId is not null)
            throw new ConflictException("You already belong to an organisation.");

        var slug = ToSlug(cmd.Name);
        if (await uow.Organizations.SlugExistsAsync(slug, ct))
            throw new ConflictException($"An organisation with slug '{slug}' already exists.");

        var prevRole = user.Role;
        if (prevRole != UserRole.Owner)
        {
            logger.LogInformation(
                "Promoting {UserId} from {PrevRole} to Owner on org creation",
                user.Id, prevRole);
        }
        user.Role = UserRole.Owner;

        var org = new Organization
        {
            Id = Guid.NewGuid(),
            Name = cmd.Name.Trim(),
            Slug = slug,
            Plan = Plan.Free,
        };
        await uow.Organizations.AddAsync(org, ct);

        user.OrganizationId = org.Id;
        await uow.Users.UpdateAsync(user, ct);
        await uow.SaveChangesAsync(ct);

        try
        {
            await keycloak.SetUserAttributesAsync(
                user.Id, UserRole.Owner.ToString().ToLowerInvariant(), org.Id, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Keycloak update failed after org creation for {UserId}; rolling back DB",
                user.Id);

            user.OrganizationId = null;
            user.Role = prevRole;
            await uow.Users.UpdateAsync(user, ct);
            await uow.SaveChangesAsync(CancellationToken.None);
            await uow.Organizations.HardDeleteAsync(org.Id, CancellationToken.None);
            throw;
        }

        logger.LogInformation(
            "Created organisation {OrgId} ({Slug}); owner {UserId} attached",
            org.Id, org.Slug, user.Id);

        return org.ToDto();
    }

    private static string ToSlug(string name)
    {
        var lower = name.Trim().ToLowerInvariant();
        var dashed = Regex.Replace(lower, @"\s+", "-");
        var collapsed = Regex.Replace(dashed, @"-{2,}", "-");
        return collapsed.Trim('-');
    }
}
