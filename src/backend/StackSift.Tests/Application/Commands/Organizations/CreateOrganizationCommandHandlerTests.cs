using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackSift.Application.Commands.Organizations;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Tests.Application.Commands.Organizations;

public class CreateOrganizationCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IOrganizationRepository> _orgs = new();
    private readonly Mock<IKeycloakAdminClient> _kc = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();

    private readonly Guid _userId = Guid.NewGuid();

    public CreateOrganizationCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.Organizations).Returns(_orgs.Object);

        _currentUser.Setup(u => u.UserId).Returns(_userId);
        _currentUser.Setup(u => u.OrganizationId).Returns(Guid.Empty);
    }

    private CreateOrganizationCommandHandler NewHandler() => new(
        _uow.Object, _kc.Object, _currentUser.Object,
        NullLogger<CreateOrganizationCommandHandler>.Instance);

    private User SeededOrglessUser(UserRole role = UserRole.Owner) =>
        new()
        {
            Id = _userId,
            Email = "alice@example.com",
            DisplayName = "Alice",
            Role = role,
            OrganizationId = null,
        };

    private void SetupOrglessUser(UserRole role = UserRole.Owner)
    {
        var user = SeededOrglessUser(role);
        _users.Setup(r => r.GetByIdAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
    }

    [Fact]
    public async Task HappyPath_InsertsOrg_LinksUser_AndUpdatesKeycloak()
    {
        SetupOrglessUser();
        _orgs.Setup(r => r.SlugExistsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var result = await NewHandler().Handle(
            new CreateOrganizationCommand("Acme Corp"), default);

        result.Name.Should().Be("Acme Corp");
        result.Slug.Should().Be("acme-corp");
        result.Plan.Should().Be(Plan.Free);

        Organization? captured = null;
        _orgs.Verify(r => r.AddAsync(It.IsAny<Organization>(), It.IsAny<CancellationToken>()), Times.Once);
        _orgs.Invocations
            .Where(i => i.Method.Name == nameof(IOrganizationRepository.AddAsync))
            .Select(i => i.Arguments[0])
            .OfType<Organization>()
            .ToList()
            .ForEach(o => captured = o);

        captured.Should().NotBeNull();
        captured!.Slug.Should().Be("acme-corp");
        captured.Plan.Should().Be(Plan.Free);

        _users.Verify(r => r.UpdateAsync(
            It.Is<User>(u => u.OrganizationId == captured!.Id && u.Role == UserRole.Owner),
            It.IsAny<CancellationToken>()),
            Times.Once);
        _kc.Verify(k => k.SetUserAttributesAsync(
            _userId, "owner", captured!.Id, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Theory]
    [InlineData("Acme Corp", "acme-corp")]
    [InlineData("  My   Org  ", "my-org")]
    [InlineData("Hello-World", "hello-world")]
    [InlineData("Multi   Space  Org", "multi-space-org")]
    public async Task SlugIsDerivedFromName(string name, string expectedSlug)
    {
        SetupOrglessUser();
        _orgs.Setup(r => r.SlugExistsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var result = await NewHandler().Handle(new CreateOrganizationCommand(name), default);
        result.Slug.Should().Be(expectedSlug);
    }

    [Fact]
    public async Task CallerAlreadyHasOrg_FromClaim_Returns409()
    {
        _currentUser.Setup(u => u.OrganizationId).Returns(Guid.NewGuid());

        await Assert.ThrowsAsync<ConflictException>(() =>
            NewHandler().Handle(new CreateOrganizationCommand("Acme"), default));

        _users.Verify(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CallerAlreadyHasOrg_FromDbRow_Returns409()
    {
        var user = SeededOrglessUser();
        user.OrganizationId = Guid.NewGuid();
        _users.Setup(r => r.GetByIdAsync(_userId, It.IsAny<CancellationToken>())).ReturnsAsync(user);

        await Assert.ThrowsAsync<ConflictException>(() =>
            NewHandler().Handle(new CreateOrganizationCommand("Acme"), default));

        _orgs.Verify(r => r.AddAsync(It.IsAny<Organization>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CallerNotInDb_Returns404()
    {
        _users.Setup(r => r.GetByIdAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            NewHandler().Handle(new CreateOrganizationCommand("Acme"), default));
    }

    [Fact]
    public async Task SlugConflict_Returns409_WithSlugInMessage()
    {
        SetupOrglessUser();
        _orgs.Setup(r => r.SlugExistsAsync("acme-corp", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            NewHandler().Handle(new CreateOrganizationCommand("Acme Corp"), default));
        ex.Message.Should().Contain("acme-corp");
    }

    [Fact]
    public async Task KeycloakFailure_RollsBackOrgAndUser()
    {
        var user = SeededOrglessUser(UserRole.Viewer);
        _users.Setup(r => r.GetByIdAsync(_userId, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        _orgs.Setup(r => r.SlugExistsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _kc.Setup(k => k.SetUserAttributesAsync(
                _userId, It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("kc down"));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewHandler().Handle(new CreateOrganizationCommand("Acme"), default));

        user.OrganizationId.Should().BeNull();
        user.Role.Should().Be(UserRole.Viewer);
        _orgs.Verify(r => r.HardDeleteAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.AtLeast(2));
    }

    [Fact]
    public async Task OwnerRoleIsForced_EvenIfCallerHasNonOwnerRole()
    {
        var user = SeededOrglessUser(UserRole.Viewer);
        _users.Setup(r => r.GetByIdAsync(_userId, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        _orgs.Setup(r => r.SlugExistsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        await NewHandler().Handle(new CreateOrganizationCommand("Acme"), default);

        user.Role.Should().Be(UserRole.Owner);
        _kc.Verify(k => k.SetUserAttributesAsync(
            _userId, "owner", It.IsAny<Guid?>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
