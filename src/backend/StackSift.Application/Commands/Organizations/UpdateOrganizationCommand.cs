using FluentValidation;
using MediatR;
using StackSift.Application.DTOs;

namespace StackSift.Application.Commands.Organizations;

public record UpdateOrganizationCommand(Guid Id, string Name, string? LogoUrl) : IRequest<OrganizationDto>;

public sealed class UpdateOrganizationCommandValidator : AbstractValidator<UpdateOrganizationCommand>
{
    public UpdateOrganizationCommandValidator()
    {
        RuleFor(c => c.Name)
            .NotEmpty()
            .MinimumLength(2)
            .MaximumLength(50)
            .Matches(@"^[a-zA-Z0-9][a-zA-Z0-9 \-]*$")
            .WithMessage(
                "Name must start with a letter or number and contain only letters, numbers, spaces, and hyphens.");

        RuleFor(c => c.LogoUrl)
            .MaximumLength(2048)
            .Must(value => string.IsNullOrWhiteSpace(value) || Uri.TryCreate(value, UriKind.Absolute, out _))
            .WithMessage("Logo URL must be an absolute URL.");
    }
}

public sealed class UpdateOrganizationCommandHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser)
    : IRequestHandler<UpdateOrganizationCommand, OrganizationDto>
{
    public async Task<OrganizationDto> Handle(UpdateOrganizationCommand request, CancellationToken ct)
    {
        if (request.Id != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Organization), request.Id);

        var org = await uow.Organizations.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(Organization), request.Id);

        org.Name = request.Name.Trim();
        org.LogoUrl = string.IsNullOrWhiteSpace(request.LogoUrl) ? null : request.LogoUrl.Trim();

        await uow.Organizations.UpdateAsync(org, ct);
        await uow.SaveChangesAsync(ct);

        return org.ToDto();
    }
}
