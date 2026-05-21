using FluentAssertions;
using Moq;
using StackSift.Application.Queries.Billing;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Tests.Application.Billing;

public class GetSubscriptionQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IOrganizationRepository> _orgs = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Guid _orgId = Guid.NewGuid();

    public GetSubscriptionQueryHandlerTests()
    {
        _currentUser.Setup(x => x.OrganizationId).Returns(_orgId);
        _uow.Setup(x => x.Organizations).Returns(_orgs.Object);
    }

    [Fact]
    public async Task ReturnsFreeNone_ForUnpurchasedOrg()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Plan = Plan.Free, SubscriptionStatus = SubscriptionStatus.None });

        var handler = new GetSubscriptionQueryHandler(_uow.Object, _currentUser.Object);
        var result = await handler.Handle(new GetSubscriptionQuery(), default);

        result.Plan.Should().Be(Plan.Free);
        result.Status.Should().Be(SubscriptionStatus.None);
        result.HasStripeCustomer.Should().BeFalse();
        result.CurrentPeriodEnd.Should().BeNull();
        result.CancelAtPeriodEnd.Should().BeFalse();
    }

    [Fact]
    public async Task ReturnsFreeDefaults_WhenOrgRowMissing()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Organization?)null);

        var handler = new GetSubscriptionQueryHandler(_uow.Object, _currentUser.Object);
        var result = await handler.Handle(new GetSubscriptionQuery(), default);

        result.Plan.Should().Be(Plan.Free);
        result.Status.Should().Be(SubscriptionStatus.None);
        result.HasStripeCustomer.Should().BeFalse();
        result.CurrentPeriodEnd.Should().BeNull();
        result.CancelAtPeriodEnd.Should().BeFalse();
    }

    [Fact]
    public async Task ReturnsPaidActive_ForOrgWithSubscription()
    {
        var periodEnd = DateTimeOffset.UtcNow.AddDays(20);
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization
            {
                Id = _orgId,
                Plan = Plan.Indie,
                SubscriptionStatus = SubscriptionStatus.Active,
                StripeCustomerId = "cus_x",
                StripeSubscriptionId = "sub_x",
                CurrentPeriodEnd = periodEnd,
                CancelAtPeriodEnd = true,
            });

        var handler = new GetSubscriptionQueryHandler(_uow.Object, _currentUser.Object);
        var result = await handler.Handle(new GetSubscriptionQuery(), default);

        result.Plan.Should().Be(Plan.Indie);
        result.Status.Should().Be(SubscriptionStatus.Active);
        result.HasStripeCustomer.Should().BeTrue();
        result.CurrentPeriodEnd.Should().Be(periodEnd);
        result.CancelAtPeriodEnd.Should().BeTrue();
    }
}
