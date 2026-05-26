using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.Billing;

public record CreatePortalSessionCommand(BillingPortalFlow Flow = BillingPortalFlow.Default)
    : IRequest<PortalSessionDto>;

/// <summary>
/// High-level Stripe Customer Portal entry points.
/// <c>Default</c> opens the standard portal home; <c>SubscriptionUpdate</c> jumps directly
/// to the plan-change step for the org's current subscription.
/// </summary>
public enum BillingPortalFlow
{
    Default,
    SubscriptionUpdate,
}

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

        StripePortalFlow? flow = null;
        if (request.Flow == BillingPortalFlow.SubscriptionUpdate)
        {
            if (string.IsNullOrEmpty(org.StripeSubscriptionId))
                throw new ConflictException("No active subscription to update.");

            flow = new StripePortalFlow("subscription_update", org.StripeSubscriptionId);
        }

        var session = await stripe.CreatePortalSessionAsync(org.StripeCustomerId!, flow, ct);
        return new PortalSessionDto(session.Url);
    }
}
