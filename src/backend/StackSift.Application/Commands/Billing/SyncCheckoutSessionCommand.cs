using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Application.Messages;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.Billing;

/// <summary>
/// Reconciles an org's plan from a Stripe Checkout Session, without waiting for the
/// webhook. The <c>/billing/success</c> page calls this on load so that a missed or
/// delayed <c>checkout.session.completed</c> webhook does not leave the org stuck on
/// the previous plan. Idempotent: applying the same paid session twice is a no-op.
/// </summary>
public record SyncCheckoutSessionCommand(string SessionId) : IRequest<SubscriptionDto>;

public class SyncCheckoutSessionCommandValidator : AbstractValidator<SyncCheckoutSessionCommand>
{
    public SyncCheckoutSessionCommandValidator()
    {
        RuleFor(x => x.SessionId)
            .NotEmpty()
            .Matches(@"^cs_[a-zA-Z0-9_]+$")
            .WithMessage("Invalid Stripe Checkout Session ID.");
    }
}

public class SyncCheckoutSessionCommandHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser,
    IStripeService stripe,
    IMessagePublisher publisher,
    IAlertHubService alertHub,
    ILogger<SyncCheckoutSessionCommandHandler> logger)
    : IRequestHandler<SyncCheckoutSessionCommand, SubscriptionDto>
{
    public async Task<SubscriptionDto> Handle(SyncCheckoutSessionCommand request, CancellationToken ct)
    {
        var org = await uow.Organizations.GetByIdAsync(currentUser.OrganizationId, ct)
            ?? throw new NotFoundException(nameof(Organization), currentUser.OrganizationId);

        var session = await stripe.GetCheckoutSessionAsync(request.SessionId, ct)
            ?? throw new NotFoundException("CheckoutSession", request.SessionId);

        // Only act on sessions that belong to this org. Without this check, any
        // authenticated caller could push another org's session through and trigger
        // mutations on the wrong organisation.
        if (!session.Metadata.TryGetValue("organization_id", out var sessionOrgIdRaw) ||
            !Guid.TryParse(sessionOrgIdRaw, out var sessionOrgId) ||
            sessionOrgId != org.Id)
        {
            throw new ForbiddenException("Checkout session does not belong to this organisation.");
        }

        // "paid" means Stripe has captured the payment. Sessions that are still
        // "unpaid" or were abandoned should not flip the plan.
        var paid = string.Equals(session.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase)
                || string.Equals(session.PaymentStatus, "no_payment_required", StringComparison.OrdinalIgnoreCase);

        if (!paid)
        {
            logger.LogInformation(
                "Checkout sync: session {SessionId} for org {OrgId} is {Status}/{PaymentStatus}; no plan change",
                session.Id, org.Id, session.Status, session.PaymentStatus);

            return ToDto(org);
        }

        var changed = false;

        if (!string.IsNullOrWhiteSpace(session.CustomerId) && org.StripeCustomerId != session.CustomerId)
        {
            org.StripeCustomerId = session.CustomerId;
            changed = true;
        }

        if (!string.IsNullOrWhiteSpace(session.SubscriptionId) && org.StripeSubscriptionId != session.SubscriptionId)
        {
            org.StripeSubscriptionId = session.SubscriptionId;
            changed = true;
        }

        if (TryResolvePaidPlan(session.Metadata.GetValueOrDefault("target_plan"), out var targetPlan)
            && org.Plan != targetPlan)
        {
            org.Plan = targetPlan;
            changed = true;
        }

        if (org.SubscriptionStatus != SubscriptionStatus.Active)
        {
            org.SubscriptionStatus = SubscriptionStatus.Active;
            changed = true;
        }

        if (changed)
        {
            await uow.SaveChangesAsync(ct);

            await publisher.PublishAsync(
                new OrgPlanChangedMessage(org.Id, org.Plan, org.SubscriptionStatus, org.CurrentPeriodEnd), ct);

            await alertHub.BroadcastSubscriptionUpdatedAsync(org.Id, ToDto(org), ct);

            logger.LogInformation(
                "Checkout sync applied for org {OrgId} from session {SessionId} → plan {Plan}",
                org.Id, session.Id, org.Plan);
        }

        return ToDto(org);
    }

    private static SubscriptionDto ToDto(Organization org) => new(
        Plan: org.Plan,
        Status: org.SubscriptionStatus,
        CurrentPeriodEnd: org.CurrentPeriodEnd,
        CancelAtPeriodEnd: org.CancelAtPeriodEnd,
        HasStripeCustomer: !string.IsNullOrEmpty(org.StripeCustomerId));

    private static bool TryResolvePaidPlan(string? value, out Plan plan)
    {
        if (Enum.TryParse(value, ignoreCase: true, out plan) && plan is Plan.Indie or Plan.Team)
            return true;

        plan = Plan.Free;
        return false;
    }
}
