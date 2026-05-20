using MediatR;
using StackSift.Application.DTOs;
using StackSift.Domain.Entities;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;

namespace StackSift.Application.Queries.Billing;

public record GetSubscriptionQuery : IRequest<SubscriptionDto>;

public class GetSubscriptionQueryHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<GetSubscriptionQuery, SubscriptionDto>
{
    public async Task<SubscriptionDto> Handle(GetSubscriptionQuery request, CancellationToken ct)
    {
        var org = await uow.Organizations.GetByIdAsync(currentUser.OrganizationId, ct)
            ?? throw new NotFoundException(nameof(Organization), currentUser.OrganizationId);

        return new SubscriptionDto(
            Plan: org.Plan,
            Status: org.SubscriptionStatus,
            CurrentPeriodEnd: org.CurrentPeriodEnd,
            CancelAtPeriodEnd: org.CancelAtPeriodEnd,
            HasStripeCustomer: !string.IsNullOrEmpty(org.StripeCustomerId));
    }
}
