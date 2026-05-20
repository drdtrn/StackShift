using FluentAssertions;
using Microsoft.Extensions.Options;
using Moq;
using StackSift.Application.Commands.Billing;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Tests.Application.Billing;

public class CreateCheckoutSessionCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IOrganizationRepository> _orgs = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Mock<IStripeService> _stripe = new();

    private readonly Guid _orgId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly IOptions<BillingPriceMap> _priceMap =
        Options.Create(new BillingPriceMap { Indie = "price_indie", Team = "price_team" });

    public CreateCheckoutSessionCommandHandlerTests()
    {
        _currentUser.Setup(x => x.OrganizationId).Returns(_orgId);
        _currentUser.Setup(x => x.UserId).Returns(_userId);
        _currentUser.Setup(x => x.Email).Returns("owner@example.com");
        _uow.Setup(x => x.Organizations).Returns(_orgs.Object);
    }

    private CreateCheckoutSessionCommandHandler NewHandler() =>
        new(_uow.Object, _currentUser.Object, _stripe.Object, _priceMap);

    [Fact]
    public async Task ReusesExistingStripeCustomer()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Name = "Acme", StripeCustomerId = "cus_existing" });

        _stripe.Setup(s => s.CreateCheckoutSessionAsync(
                "cus_existing", "price_indie",
                It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeCheckoutResult("cs_1", "https://checkout.stripe.com/cs_1"));

        var result = await NewHandler().Handle(new CreateCheckoutSessionCommand(Plan.Indie, null), default);

        result.Url.Should().Be("https://checkout.stripe.com/cs_1");
        _stripe.Verify(s => s.EnsureCustomerAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task CreatesStripeCustomer_WhenOrgHasNone()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Name = "Acme" });

        _stripe.Setup(s => s.EnsureCustomerAsync(_orgId, "Acme", "owner@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeCustomerResult("cus_new"));

        _stripe.Setup(s => s.CreateCheckoutSessionAsync(
                "cus_new", "price_team",
                It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeCheckoutResult("cs_2", "https://checkout.stripe.com/cs_2"));

        var result = await NewHandler().Handle(new CreateCheckoutSessionCommand(Plan.Team, "marketing-hero"), default);

        result.SessionId.Should().Be("cs_2");
        _stripe.Verify(s => s.EnsureCustomerAsync(_orgId, "Acme", "owner@example.com", It.IsAny<CancellationToken>()),
            Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PassesAcquisitionSource_IntoStripeMetadata()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Name = "Acme", StripeCustomerId = "cus_x" });

        IReadOnlyDictionary<string, string>? capturedMetadata = null;
        _stripe.Setup(s => s.CreateCheckoutSessionAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<IReadOnlyDictionary<string, string>>(),
                It.IsAny<CancellationToken>()))
            .Callback<string, string, string, IReadOnlyDictionary<string, string>, CancellationToken>(
                (_, _, _, md, _) => capturedMetadata = md)
            .ReturnsAsync(new StripeCheckoutResult("cs_3", "https://checkout.stripe.com/cs_3"));

        await NewHandler().Handle(
            new CreateCheckoutSessionCommand(Plan.Indie, "marketing-pricing-indie"), default);

        capturedMetadata.Should().NotBeNull();
        capturedMetadata!["organization_id"].Should().Be(_orgId.ToString());
        capturedMetadata["target_plan"].Should().Be("Indie");
        capturedMetadata["actor_user_id"].Should().Be(_userId.ToString());
        capturedMetadata["acquisition_source"].Should().Be("marketing-pricing-indie");
    }

    [Fact]
    public async Task DefaultsAcquisitionSource_ToDirect_WhenNotProvided()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Name = "Acme", StripeCustomerId = "cus_x" });

        IReadOnlyDictionary<string, string>? capturedMetadata = null;
        _stripe.Setup(s => s.CreateCheckoutSessionAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<IReadOnlyDictionary<string, string>>(),
                It.IsAny<CancellationToken>()))
            .Callback<string, string, string, IReadOnlyDictionary<string, string>, CancellationToken>(
                (_, _, _, md, _) => capturedMetadata = md)
            .ReturnsAsync(new StripeCheckoutResult("cs_4", "https://checkout.stripe.com/cs_4"));

        await NewHandler().Handle(new CreateCheckoutSessionCommand(Plan.Indie, null), default);

        capturedMetadata!["acquisition_source"].Should().Be("direct");
    }

    [Fact]
    public async Task ThrowsConflict_WhenStripePriceNotConfigured()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Name = "Acme" });

        var emptyPriceMap = Options.Create(new BillingPriceMap { Indie = "", Team = "" });
        var handler = new CreateCheckoutSessionCommandHandler(_uow.Object, _currentUser.Object, _stripe.Object, emptyPriceMap);

        await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(new CreateCheckoutSessionCommand(Plan.Indie, null), default));
    }

    [Fact]
    public async Task ThrowsNotFound_WhenOrgMissing()
    {
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Organization?)null);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            NewHandler().Handle(new CreateCheckoutSessionCommand(Plan.Indie, null), default));
    }
}

public class CreateCheckoutSessionCommandValidatorTests
{
    private readonly CreateCheckoutSessionCommandValidator _validator = new();

    [Fact]
    public void FreePlan_FailsValidation()
    {
        var result = _validator.Validate(new CreateCheckoutSessionCommand(Plan.Free, null));
        result.IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData("marketing-hero")]
    [InlineData("marketing-pricing-indie")]
    [InlineData("final-cta")]
    [InlineData(null)]
    [InlineData("")]
    public void ValidAcquisitionSource_Passes(string? source)
    {
        var result = _validator.Validate(new CreateCheckoutSessionCommand(Plan.Indie, source));
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("../evil")]
    [InlineData("has space")]
    [InlineData("has<script>")]
    public void InvalidAcquisitionSource_Fails(string source)
    {
        var result = _validator.Validate(new CreateCheckoutSessionCommand(Plan.Indie, source));
        result.IsValid.Should().BeFalse();
    }
}
