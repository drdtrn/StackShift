using FluentAssertions;
using Moq;
using StackSift.Application.Commands.Billing;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Tests.Application.Billing;

public class CreatePortalSessionCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IOrganizationRepository> _orgs = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Mock<IStripeService> _stripe = new();
    private readonly Guid _orgId = Guid.NewGuid();

    public CreatePortalSessionCommandHandlerTests()
    {
        _currentUser.Setup(x => x.OrganizationId).Returns(_orgId);
        _uow.Setup(x => x.Organizations).Returns(_orgs.Object);
    }

    [Fact]
    public async Task ReturnsPortalUrl_WhenStripeCustomerExists()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, StripeCustomerId = "cus_x" });

        _stripe.Setup(s => s.CreatePortalSessionAsync("cus_x", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripePortalResult("https://billing.stripe.com/portal/abc"));

        var handler = new CreatePortalSessionCommandHandler(_uow.Object, _currentUser.Object, _stripe.Object);
        var result = await handler.Handle(new CreatePortalSessionCommand(), default);

        result.Url.Should().Be("https://billing.stripe.com/portal/abc");
    }

    [Fact]
    public async Task ThrowsConflict_WhenNoStripeCustomerYet()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, StripeCustomerId = null });

        var handler = new CreatePortalSessionCommandHandler(_uow.Object, _currentUser.Object, _stripe.Object);

        await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(new CreatePortalSessionCommand(), default));
    }
}
