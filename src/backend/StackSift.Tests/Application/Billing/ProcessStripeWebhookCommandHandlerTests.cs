using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using StackSift.Application.Commands.Billing;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Application.Messages;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;

namespace StackSift.Tests.Application.Billing;

public class ProcessStripeWebhookCommandHandlerTests
{
    private readonly Mock<IStripeWebhookStore> _store = new();
    private readonly Mock<IStripeService> _stripe = new();
    private readonly Mock<IMessagePublisher> _publisher = new();
    private readonly Mock<IAlertHubService> _hub = new();
    private readonly IOptions<BillingPriceMap> _priceMap =
        Options.Create(new BillingPriceMap { Indie = "price_indie", Team = "price_team" });

    private ProcessStripeWebhookCommandHandler NewHandler() => new(
        _store.Object, _stripe.Object, _publisher.Object, _hub.Object, _priceMap,
        NullLogger<ProcessStripeWebhookCommandHandler>.Instance);

    [Fact]
    public async Task TamperedSignature_ThrowsValidationException()
    {
        _stripe.Setup(s => s.VerifyAndParseEvent(It.IsAny<string>(), It.IsAny<string>()))
            .Throws(new StripeSignatureException("signature mismatch"));

        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() =>
            NewHandler().Handle(new ProcessStripeWebhookCommand("{}", "bad-sig"), default));

        _store.Verify(s => s.AddAsync(It.IsAny<StripeWebhookEvent>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ReplayedEvent_IsNoOp()
    {
        var evt = NewSubscriptionEvent("active", "price_indie", Guid.NewGuid());
        _stripe.Setup(s => s.VerifyAndParseEvent(It.IsAny<string>(), It.IsAny<string>())).Returns(evt);

        var alreadyProcessed = new StripeWebhookEvent
        {
            EventId = evt.Id,
            EventType = evt.Type,
            ProcessedAt = DateTimeOffset.UtcNow.AddMinutes(-5),
            PayloadJson = evt.RawJson,
        };
        _store.Setup(s => s.FindByEventIdAsync(evt.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(alreadyProcessed);

        await NewHandler().Handle(new ProcessStripeWebhookCommand("{}", "sig"), default);

        _store.Verify(s => s.AddAsync(It.IsAny<StripeWebhookEvent>(), It.IsAny<CancellationToken>()), Times.Never);
        _publisher.Verify(p => p.PublishAsync(It.IsAny<OrgPlanChangedMessage>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SubscriptionCreated_UpgradesOrgToIndie()
    {
        var orgId = Guid.NewGuid();
        var evt = NewSubscriptionEvent("active", "price_indie", orgId);
        _stripe.Setup(s => s.VerifyAndParseEvent(It.IsAny<string>(), It.IsAny<string>())).Returns(evt);
        _store.Setup(s => s.FindByEventIdAsync(evt.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((StripeWebhookEvent?)null);

        var org = new Organization { Id = orgId, Plan = Plan.Free, SubscriptionStatus = SubscriptionStatus.None };
        _store.Setup(s => s.FindOrgBySubscriptionOrCustomerAsync(
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<IReadOnlyDictionary<string, string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(org);

        await NewHandler().Handle(new ProcessStripeWebhookCommand("{}", "sig"), default);

        org.Plan.Should().Be(Plan.Indie);
        org.SubscriptionStatus.Should().Be(SubscriptionStatus.Active);
        org.StripeSubscriptionId.Should().Be("sub_abc");
        org.StripePriceId.Should().Be("price_indie");
        _publisher.Verify(p => p.PublishAsync(
            It.Is<OrgPlanChangedMessage>(m => m.OrganizationId == orgId && m.NewPlan == Plan.Indie),
            It.IsAny<CancellationToken>()), Times.Once);
        _hub.Verify(h => h.BroadcastSubscriptionUpdatedAsync(
            orgId, It.IsAny<SubscriptionDto>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SubscriptionUpdated_IndieToTeam_FlipsPlan()
    {
        var orgId = Guid.NewGuid();
        var evt = NewSubscriptionEvent("active", "price_team", orgId, type: "customer.subscription.updated");
        _stripe.Setup(s => s.VerifyAndParseEvent(It.IsAny<string>(), It.IsAny<string>())).Returns(evt);
        _store.Setup(s => s.FindByEventIdAsync(evt.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((StripeWebhookEvent?)null);

        var org = new Organization { Id = orgId, Plan = Plan.Indie, StripePriceId = "price_indie" };
        _store.Setup(s => s.FindOrgBySubscriptionOrCustomerAsync(
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<IReadOnlyDictionary<string, string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(org);

        await NewHandler().Handle(new ProcessStripeWebhookCommand("{}", "sig"), default);

        org.Plan.Should().Be(Plan.Team);
        org.StripePriceId.Should().Be("price_team");
    }

    [Fact]
    public async Task SubscriptionDeleted_DowngradesToFree()
    {
        var orgId = Guid.NewGuid();
        var evt = NewSubscriptionEvent("canceled", "price_indie", orgId, type: "customer.subscription.deleted");
        _stripe.Setup(s => s.VerifyAndParseEvent(It.IsAny<string>(), It.IsAny<string>())).Returns(evt);
        _store.Setup(s => s.FindByEventIdAsync(evt.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((StripeWebhookEvent?)null);

        var org = new Organization
        {
            Id = orgId, Plan = Plan.Indie, SubscriptionStatus = SubscriptionStatus.Active,
            StripeSubscriptionId = "sub_abc", StripePriceId = "price_indie",
            CurrentPeriodEnd = DateTimeOffset.UtcNow.AddDays(10), CancelAtPeriodEnd = true,
        };
        _store.Setup(s => s.FindOrgBySubscriptionOrCustomerAsync(
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<IReadOnlyDictionary<string, string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(org);

        await NewHandler().Handle(new ProcessStripeWebhookCommand("{}", "sig"), default);

        org.Plan.Should().Be(Plan.Free);
        org.SubscriptionStatus.Should().Be(SubscriptionStatus.Canceled);
        org.StripeSubscriptionId.Should().BeNull();
        org.StripePriceId.Should().BeNull();
        org.CurrentPeriodEnd.Should().BeNull();
        org.CancelAtPeriodEnd.Should().BeFalse();
    }

    [Fact]
    public async Task InvoicePaymentFailed_SetsPastDue_WithoutTouchingPlan()
    {
        var orgId = Guid.NewGuid();
        var evt = new VerifiedStripeEvent(
            Id: "evt_pay_fail",
            Type: "invoice.payment_failed",
            RawJson: "{}",
            Subscription: null,
            Invoice: new StripeInvoicePayload("in_x", "sub_abc", "cus_x"),
            Checkout: null);

        _stripe.Setup(s => s.VerifyAndParseEvent(It.IsAny<string>(), It.IsAny<string>())).Returns(evt);
        _store.Setup(s => s.FindByEventIdAsync(evt.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((StripeWebhookEvent?)null);

        var org = new Organization { Id = orgId, Plan = Plan.Indie, SubscriptionStatus = SubscriptionStatus.Active };
        _store.Setup(s => s.FindOrgBySubscriptionIdAsync("sub_abc", It.IsAny<CancellationToken>()))
            .ReturnsAsync(org);

        await NewHandler().Handle(new ProcessStripeWebhookCommand("{}", "sig"), default);

        org.SubscriptionStatus.Should().Be(SubscriptionStatus.PastDue);
        org.Plan.Should().Be(Plan.Indie);
    }

    [Fact]
    public async Task UnknownEventType_ReturnsSuccess_NoSideEffects()
    {
        var evt = new VerifiedStripeEvent(
            Id: "evt_unknown",
            Type: "customer.discount.created",
            RawJson: "{}",
            Subscription: null, Invoice: null, Checkout: null);

        _stripe.Setup(s => s.VerifyAndParseEvent(It.IsAny<string>(), It.IsAny<string>())).Returns(evt);
        _store.Setup(s => s.FindByEventIdAsync(evt.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((StripeWebhookEvent?)null);

        await NewHandler().Handle(new ProcessStripeWebhookCommand("{}", "sig"), default);

        _publisher.Verify(p => p.PublishAsync(It.IsAny<OrgPlanChangedMessage>(), It.IsAny<CancellationToken>()), Times.Never);
        _hub.Verify(h => h.BroadcastSubscriptionUpdatedAsync(
            It.IsAny<Guid>(), It.IsAny<SubscriptionDto>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SubscriptionEvent_ForUnknownOrg_LogsWarning_NoUpdate()
    {
        var evt = NewSubscriptionEvent("active", "price_indie", Guid.NewGuid());
        _stripe.Setup(s => s.VerifyAndParseEvent(It.IsAny<string>(), It.IsAny<string>())).Returns(evt);
        _store.Setup(s => s.FindByEventIdAsync(evt.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((StripeWebhookEvent?)null);
        _store.Setup(s => s.FindOrgBySubscriptionOrCustomerAsync(
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<IReadOnlyDictionary<string, string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Organization?)null);

        await NewHandler().Handle(new ProcessStripeWebhookCommand("{}", "sig"), default);

        _publisher.Verify(p => p.PublishAsync(It.IsAny<OrgPlanChangedMessage>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandlerThrowsMidProcess_RecordsErrorAndRethrows()
    {
        var orgId = Guid.NewGuid();
        var evt = NewSubscriptionEvent("active", "price_indie", orgId);
        _stripe.Setup(s => s.VerifyAndParseEvent(It.IsAny<string>(), It.IsAny<string>())).Returns(evt);
        _store.Setup(s => s.FindByEventIdAsync(evt.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((StripeWebhookEvent?)null);

        var org = new Organization { Id = orgId, Plan = Plan.Free };
        _store.Setup(s => s.FindOrgBySubscriptionOrCustomerAsync(
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<IReadOnlyDictionary<string, string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(org);
        _publisher.Setup(p => p.PublishAsync(It.IsAny<OrgPlanChangedMessage>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("rabbit down"));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewHandler().Handle(new ProcessStripeWebhookCommand("{}", "sig"), default));
    }

    private static VerifiedStripeEvent NewSubscriptionEvent(
        string status, string priceId, Guid orgId, string type = "customer.subscription.created") =>
        new(
            Id: $"evt_{Guid.NewGuid():N}",
            Type: type,
            RawJson: "{}",
            Subscription: new StripeSubscriptionPayload(
                Id: "sub_abc",
                CustomerId: "cus_abc",
                Status: status,
                PriceId: priceId,
                CurrentPeriodEnd: DateTimeOffset.UtcNow.AddDays(30),
                CancelAtPeriodEnd: false,
                Metadata: new Dictionary<string, string> { ["organization_id"] = orgId.ToString() }),
            Invoice: null,
            Checkout: null);
}
