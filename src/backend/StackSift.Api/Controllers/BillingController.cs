using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StackSift.Api.Models.Requests;
using StackSift.Application.Commands.Billing;
using StackSift.Application.DTOs;
using StackSift.Application.Queries.Billing;

namespace StackSift.Api.Controllers;

/// <summary>Subscription, checkout, and customer-portal endpoints.</summary>
[Route("api/v1/billing")]
public class BillingController(IMediator mediator) : BaseApiController(mediator)
{
    /// <summary>Returns the current organisation's subscription state.</summary>
    /// <returns>Plan, status, period boundary, cancellation flag, and whether a Stripe customer exists.</returns>
    /// <response code="200">Subscription DTO.</response>
    /// <response code="401">No authenticated session.</response>
    /// <response code="404">Caller's organisation could not be loaded.</response>
    [HttpGet("subscription")]
    [ProducesResponseType(typeof(SubscriptionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSubscription(CancellationToken ct)
        => Ok(await Mediator.Send(new GetSubscriptionQuery(), ct));

    /// <summary>Creates a Stripe Checkout session for upgrading to a paid plan.</summary>
    /// <remarks>The response carries a Stripe-hosted URL; the client must perform a
    /// top-level navigation (<c>window.location.href</c>) to it.</remarks>
    /// <param name="body">Target plan and optional marketing-attribution slug.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Stripe Checkout session ID and URL.</returns>
    /// <response code="200">Checkout session created.</response>
    /// <response code="400">Validation failure (e.g. <c>plan=Free</c>, malformed <c>from</c>).</response>
    /// <response code="401">No authenticated session.</response>
    /// <response code="403">Caller is not an organisation owner.</response>
    /// <response code="409">Stripe price for the target plan is not configured.</response>
    [HttpPost("checkout-session")]
    [Authorize(Policy = "OwnerOnly")]
    [ProducesResponseType(typeof(CheckoutSessionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateCheckoutSession(
        [FromBody] CreateCheckoutSessionBody body, CancellationToken ct)
        => Ok(await Mediator.Send(new CreateCheckoutSessionCommand(body.Plan, body.From), ct));

    /// <summary>Creates a Stripe Customer Portal session for managing the existing subscription.</summary>
    /// <param name="body">Optional flow hint — e.g. <c>SubscriptionUpdate</c> to land on plan-change.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Stripe-hosted portal URL.</returns>
    /// <response code="200">Portal session created.</response>
    /// <response code="401">No authenticated session.</response>
    /// <response code="403">Caller is not an organisation owner.</response>
    /// <response code="409">Organisation has never purchased — nothing to manage.</response>
    [HttpPost("portal-session")]
    [Authorize(Policy = "OwnerOnly")]
    [ProducesResponseType(typeof(PortalSessionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreatePortalSession(
        [FromBody] CreatePortalSessionBody? body, CancellationToken ct)
        => Ok(await Mediator.Send(
            new CreatePortalSessionCommand(body?.Flow ?? BillingPortalFlow.Default), ct));

    /// <summary>
    /// Reconciles the org's plan from a completed Stripe Checkout Session. The
    /// <c>/billing/success</c> page calls this so a missed webhook does not leave the
    /// org stuck on the previous plan. Idempotent.
    /// </summary>
    /// <param name="id">The Stripe Checkout Session ID returned in the success-URL query.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The org's subscription state after reconciliation.</returns>
    /// <response code="200">Reconcile run; current subscription state returned.</response>
    /// <response code="400">Session ID malformed.</response>
    /// <response code="401">No authenticated session.</response>
    /// <response code="403">Session belongs to a different organisation.</response>
    /// <response code="404">Session not found at Stripe.</response>
    [HttpPost("checkout-session/{id}/sync")]
    [ProducesResponseType(typeof(SubscriptionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SyncCheckoutSession(string id, CancellationToken ct)
        => Ok(await Mediator.Send(new SyncCheckoutSessionCommand(id), ct));

    /// <summary>Receives Stripe webhook events. Signature-verified, idempotent, anonymous.</summary>
    /// <remarks>Stripe POSTs events here after subscription state changes. The handler is
    /// idempotent — replayed deliveries with the same <c>event.id</c> are no-ops.</remarks>
    /// <response code="200">Event accepted (processed, replayed, or unknown type).</response>
    /// <response code="400">Stripe-Signature missing or invalid.</response>
    [HttpPost("webhook")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Webhook(CancellationToken ct)
    {
        using var reader = new StreamReader(Request.Body);
        var rawBody = await reader.ReadToEndAsync(ct);
        var signature = Request.Headers["Stripe-Signature"].ToString();

        await Mediator.Send(new ProcessStripeWebhookCommand(rawBody, signature), ct);
        return Ok();
    }
}
