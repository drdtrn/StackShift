using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackSift.Application.Commands.Billing;
using StackSift.Application.Interfaces;
using StackSift.Application.Messages;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Tests.Application.Billing;

public class SyncCheckoutSessionCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IOrganizationRepository> _orgs = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Mock<IStripeService> _stripe = new();
    private readonly Mock<IMessagePublisher> _publisher = new();
    private readonly Mock<IAlertHubService> _hub = new();
    private readonly Guid _orgId = Guid.NewGuid();

    public SyncCheckoutSessionCommandHandlerTests()
    {
        _currentUser.Setup(x => x.OrganizationId).Returns(_orgId);
        _uow.Setup(x => x.Organizations).Returns(_orgs.Object);
    }

    private SyncCheckoutSessionCommandHandler NewHandler() => new(
        _uow.Object, _currentUser.Object, _stripe.Object,
        _publisher.Object, _hub.Object,
        NullLogger<SyncCheckoutSessionCommandHandler>.Instance);

    private Organization NewOrg(Plan plan = Plan.Free, string? customerId = null, string? subId = null) =>
        new()
        {
            Id = _orgId,
            Name = "Acme",
            Plan = plan,
            SubscriptionStatus = SubscriptionStatus.None,
            StripeCustomerId = customerId,
            StripeSubscriptionId = subId,
        };

    private StripeCheckoutSessionLookup NewSession(
        string paymentStatus = "paid",
        string? targetPlan = "Team",
        string? customerId = "cus_new",
        string? subId = "sub_new") =>
        new(
            Id: "cs_test_123",
            PaymentStatus: paymentStatus,
            Status: "complete",
            CustomerId: customerId,
            SubscriptionId: subId,
            ClientReferenceId: _orgId.ToString(),
            Metadata: new Dictionary<string, string>
            {
                ["organization_id"] = _orgId.ToString(),
                ["target_plan"] = targetPlan ?? string.Empty,
            });

    [Fact]
    public async Task UpgradesPlan_WhenPaidSessionMatchesOrg()
    {
        var org = NewOrg();
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>())).ReturnsAsync(org);
        _stripe.Setup(x => x.GetCheckoutSessionAsync("cs_test_123", It.IsAny<CancellationToken>()))
            .ReturnsAsync(NewSession());

        var result = await NewHandler().Handle(new SyncCheckoutSessionCommand("cs_test_123"), default);

        org.Plan.Should().Be(Plan.Team);
        org.SubscriptionStatus.Should().Be(SubscriptionStatus.Active);
        org.StripeCustomerId.Should().Be("cus_new");
        org.StripeSubscriptionId.Should().Be("sub_new");
        result.Plan.Should().Be(Plan.Team);
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _publisher.Verify(p => p.PublishAsync(It.IsAny<OrgPlanChangedMessage>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task NoMutation_WhenSessionUnpaid()
    {
        var org = NewOrg();
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>())).ReturnsAsync(org);
        _stripe.Setup(x => x.GetCheckoutSessionAsync("cs_test_123", It.IsAny<CancellationToken>()))
            .ReturnsAsync(NewSession(paymentStatus: "unpaid"));

        var result = await NewHandler().Handle(new SyncCheckoutSessionCommand("cs_test_123"), default);

        org.Plan.Should().Be(Plan.Free);
        result.Plan.Should().Be(Plan.Free);
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Idempotent_WhenSameSessionAppliedTwice()
    {
        var org = NewOrg(Plan.Team, customerId: "cus_new", subId: "sub_new");
        org.SubscriptionStatus = SubscriptionStatus.Active;

        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>())).ReturnsAsync(org);
        _stripe.Setup(x => x.GetCheckoutSessionAsync("cs_test_123", It.IsAny<CancellationToken>()))
            .ReturnsAsync(NewSession());

        await NewHandler().Handle(new SyncCheckoutSessionCommand("cs_test_123"), default);

        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        _publisher.Verify(p => p.PublishAsync(It.IsAny<OrgPlanChangedMessage>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Forbidden_WhenSessionMetadataPointsToDifferentOrg()
    {
        var org = NewOrg();
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>())).ReturnsAsync(org);

        var otherOrgSession = new StripeCheckoutSessionLookup(
            Id: "cs_test_123",
            PaymentStatus: "paid",
            Status: "complete",
            CustomerId: "cus_x",
            SubscriptionId: "sub_x",
            ClientReferenceId: null,
            Metadata: new Dictionary<string, string>
            {
                ["organization_id"] = Guid.NewGuid().ToString(),
                ["target_plan"] = "Team",
            });

        _stripe.Setup(x => x.GetCheckoutSessionAsync("cs_test_123", It.IsAny<CancellationToken>()))
            .ReturnsAsync(otherOrgSession);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            NewHandler().Handle(new SyncCheckoutSessionCommand("cs_test_123"), default));

        org.Plan.Should().Be(Plan.Free);
    }

    [Fact]
    public async Task NotFound_WhenSessionMissingAtStripe()
    {
        var org = NewOrg();
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>())).ReturnsAsync(org);
        _stripe.Setup(x => x.GetCheckoutSessionAsync("cs_test_123", It.IsAny<CancellationToken>()))
            .ReturnsAsync((StripeCheckoutSessionLookup?)null);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            NewHandler().Handle(new SyncCheckoutSessionCommand("cs_test_123"), default));
    }
}
