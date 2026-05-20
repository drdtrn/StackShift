using FluentValidation;
using MediatR;
using Microsoft.Extensions.Options;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.Billing;

public record CreateCheckoutSessionCommand(Plan TargetPlan, string? AcquisitionSource)
    : IRequest<CheckoutSessionDto>;

public class CreateCheckoutSessionCommandValidator : AbstractValidator<CreateCheckoutSessionCommand>
{
    public CreateCheckoutSessionCommandValidator()
    {
        RuleFor(x => x.TargetPlan)
            .NotEqual(Plan.Free)
            .WithMessage("Cannot create a checkout session for the Free plan.");

        RuleFor(x => x.AcquisitionSource)
            .MaximumLength(100)
            .Matches(@"^[a-zA-Z0-9\-_]+$")
            .When(x => !string.IsNullOrEmpty(x.AcquisitionSource));
    }
}

public class CreateCheckoutSessionCommandHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser,
    IStripeService stripe,
    IOptions<BillingPriceMap> priceMap)
    : IRequestHandler<CreateCheckoutSessionCommand, CheckoutSessionDto>
{
    public async Task<CheckoutSessionDto> Handle(CreateCheckoutSessionCommand request, CancellationToken ct)
    {
        var org = await uow.Organizations.GetByIdAsync(currentUser.OrganizationId, ct)
            ?? throw new NotFoundException(nameof(Organization), currentUser.OrganizationId);

        var priceId = request.TargetPlan switch
        {
            Plan.Indie => priceMap.Value.Indie,
            Plan.Team => priceMap.Value.Team,
            _ => throw new ValidationException("Unsupported plan."),
        };

        if (string.IsNullOrWhiteSpace(priceId))
            throw new ConflictException($"Stripe price for {request.TargetPlan} is not configured on this environment.");

        if (string.IsNullOrEmpty(org.StripeCustomerId))
        {
            var customer = await stripe.EnsureCustomerAsync(org.Id, org.Name, currentUser.Email, ct);
            org.StripeCustomerId = customer.CustomerId;
            await uow.SaveChangesAsync(ct);
        }

        var idempotencyKey = $"checkout-{org.Id}-{request.TargetPlan}-{DateTimeOffset.UtcNow:yyyyMMddHHmm}";

        var metadata = new Dictionary<string, string>
        {
            ["organization_id"] = org.Id.ToString(),
            ["target_plan"] = request.TargetPlan.ToString(),
            ["actor_user_id"] = currentUser.UserId.ToString(),
            ["acquisition_source"] = string.IsNullOrEmpty(request.AcquisitionSource)
                ? "direct"
                : request.AcquisitionSource,
        };

        var session = await stripe.CreateCheckoutSessionAsync(
            customerId: org.StripeCustomerId!,
            priceId: priceId,
            idempotencyKey: idempotencyKey,
            metadata: metadata,
            ct: ct);

        return new CheckoutSessionDto(session.SessionId, session.Url);
    }
}

public sealed class BillingPriceMap
{
    public string Indie { get; set; } = string.Empty;
    public string Team { get; set; } = string.Empty;
}
