using StackSift.Application.Commands.Billing;
using StackSift.Domain.Enums;

namespace StackSift.Api.Models.Requests;

/// <summary>Body for <c>POST /api/v1/billing/checkout-session</c>.</summary>
/// <param name="Plan">The plan to upgrade to. Must be Indie or Team; Free is rejected with 400.</param>
/// <param name="From">Optional marketing-attribution slug, e.g. <c>marketing-pricing-indie</c>.</param>
public sealed record CreateCheckoutSessionBody(Plan Plan, string? From);

/// <summary>Body for <c>POST /api/v1/billing/portal-session</c>.</summary>
/// <param name="Flow">
/// Optional portal entry point. <c>Default</c> opens the standard portal home; <c>SubscriptionUpdate</c>
/// jumps directly to the plan-change step (used by the "Upgrade to Team" CTA when on Indie).
/// </param>
public sealed record CreatePortalSessionBody(BillingPortalFlow Flow = BillingPortalFlow.Default);
