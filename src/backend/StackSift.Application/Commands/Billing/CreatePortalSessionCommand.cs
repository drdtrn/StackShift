using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.Billing;

public record CreatePortalSessionCommand : IRequest<PortalSessionDto>;

public class CreatePortalSessionCommandHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser,
    IStripeService stripe)
    : IRequestHandler<CreatePortalSessionCommand, PortalSessionDto>
{
    public async Task<PortalSessionDto> Handle(CreatePortalSessionCommand request, CancellationToken ct)
    {
        var org = await uow.Organizations.GetByIdAsync(currentUser.OrganizationId, ct)
            ?? throw new NotFoundException(nameof(Organization), currentUser.OrganizationId);

        if (string.IsNullOrEmpty(org.StripeCustomerId))
            throw new ConflictException("This organisation has no billing history yet — upgrade first.");

        var session = await stripe.CreatePortalSessionAsync(org.StripeCustomerId!, ct);
        return new PortalSessionDto(session.Url);
    }
}
