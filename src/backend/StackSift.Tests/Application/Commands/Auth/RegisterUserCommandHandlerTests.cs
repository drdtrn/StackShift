using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using StackSift.Application.Commands.Auth;
using StackSift.Application.Interfaces;
using StackSift.Domain;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Tests.Application.Commands.Auth;

public class RegisterUserCommandHandlerTests
{
    private readonly Mock<IKeycloakAdminClient> _kc = new();
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IInvitationRepository> _invitations = new();
    private readonly Mock<IOrganizationRepository> _orgs = new();
    private readonly Mock<ICaptchaVerifier> _captcha = new();

    public RegisterUserCommandHandlerTests()
    {
        _captcha.SetupGet(c => c.Enabled).Returns(false);
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.Invitations).Returns(_invitations.Object);
        _uow.Setup(u => u.Organizations).Returns(_orgs.Object);
        _orgs.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid id, CancellationToken _) => new Organization { Id = id, Plan = Plan.Team });
    }

    private RegisterUserCommandHandler NewHandler(bool inviteOnly = false) =>
        new(_kc.Object, _uow.Object, _captcha.Object,
            Options.Create(new RegistrationOptions { InviteOnly = inviteOnly }),
            NullLogger<RegisterUserCommandHandler>.Instance);

    private void SetupKeycloakCreate(Guid id) =>
        _kc.Setup(k => k.CreateUserAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(id);

    private void SetupNoPendingInvitation() =>
        _invitations.Setup(r => r.FindPendingByEmailAsync(
                It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Invitation?)null);

    [Fact]
    public async Task Honeypot_filled_drops_silently_without_creating_a_user()
    {
        SetupNoPendingInvitation();

        var cmd = new RegisterUserCommand("bot@example.com", "Passw0rd!23", "Bot", IsOwner: false,
            Honeypot: "http://spam.example");
        var result = await NewHandler().Handle(cmd, default);

        result.UserId.Should().Be(Guid.Empty);
        _kc.Verify(k => k.CreateUserAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
        _uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Captcha_failure_throws_and_creates_no_user()
    {
        SetupNoPendingInvitation();
        _captcha.SetupGet(c => c.Enabled).Returns(true);
        _captcha.Setup(c => c.VerifyAsync(It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var cmd = new RegisterUserCommand("alice@example.com", "Passw0rd!23", "Alice", IsOwner: false,
            CaptchaToken: "bad-token");

        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() => NewHandler().Handle(cmd, default));
        _kc.Verify(k => k.CreateUserAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HappyPath_CreatesKeycloakAndDbRecords_NoInvitation()
    {
        var newId = Guid.NewGuid();
        SetupNoPendingInvitation();
        SetupKeycloakCreate(newId);

        var cmd = new RegisterUserCommand("alice@example.com", "Passw0rd!23", "Alice", IsOwner: false);
        var result = await NewHandler().Handle(cmd, default);

        result.UserId.Should().Be(newId);
        result.Email.Should().Be("alice@example.com");
        result.Role.Should().Be("viewer");
        result.OrganizationId.Should().BeNull();
        result.AttachedViaInvitation.Should().BeFalse();

        _users.Verify(u => u.AddAsync(
            It.Is<User>(x =>
                x.Id == newId &&
                x.Email == "alice@example.com" &&
                x.Role == UserRole.Viewer &&
                x.OrganizationId == null),
            It.IsAny<CancellationToken>()),
            Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HappyPath_OwnerRoleIsRespected_WhenNoInvitation()
    {
        var newId = Guid.NewGuid();
        SetupNoPendingInvitation();
        SetupKeycloakCreate(newId);

        var result = await NewHandler().Handle(
            new RegisterUserCommand("bob@example.com", "Passw0rd!23", "Bob", IsOwner: true), default);

        result.Role.Should().Be("owner");
        _kc.Verify(k => k.CreateUserAsync(
            "bob@example.com", "Passw0rd!23", "Bob",
            "owner", null, false, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PendingInvitation_OverridesFormRole()
    {
        var newId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var inviterId = Guid.NewGuid();
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            Email = "carol@example.com",
            Role = UserRole.Admin,
            InvitedByUserId = inviterId,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(3),
            Token = "tok",
        };
        _invitations.Setup(r => r.FindPendingByEmailAsync("carol@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(invitation);
        SetupKeycloakCreate(newId);

        var result = await NewHandler().Handle(
            new RegisterUserCommand("carol@example.com", "Passw0rd!23", "Carol", IsOwner: true), default);

        result.Role.Should().Be("admin");
        result.OrganizationId.Should().Be(orgId);
        result.AttachedViaInvitation.Should().BeTrue();

        _kc.Verify(k => k.CreateUserAsync(
            "carol@example.com", "Passw0rd!23", "Carol",
            "admin", orgId, false, It.IsAny<CancellationToken>()), Times.Once);

        _users.Verify(u => u.AddAsync(
            It.Is<User>(x =>
                x.Role == UserRole.Admin &&
                x.OrganizationId == orgId &&
                x.InvitedByUserId == inviterId),
            It.IsAny<CancellationToken>()),
            Times.Once);

        invitation.AcceptedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task ExpiredInvitation_IsIgnored()
    {
        var newId = Guid.NewGuid();
        // Repo returns null for an expired invitation (filter is inside the repo);
        // simulating that contract here.
        SetupNoPendingInvitation();
        SetupKeycloakCreate(newId);

        var result = await NewHandler().Handle(
            new RegisterUserCommand("dave@example.com", "Passw0rd!23", "Dave", IsOwner: false), default);

        result.OrganizationId.Should().BeNull();
        result.AttachedViaInvitation.Should().BeFalse();
        result.Role.Should().Be("viewer");
    }

    [Fact]
    public async Task KeycloakConflict_Surfaces409()
    {
        SetupNoPendingInvitation();
        _kc.Setup(k => k.CreateUserAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new ConflictException("User with email 'eve@example.com' already exists."));

        await Assert.ThrowsAsync<ConflictException>(() =>
            NewHandler().Handle(
                new RegisterUserCommand("eve@example.com", "Passw0rd!23", "Eve", IsOwner: false), default));

        _users.Verify(u => u.AddAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()), Times.Never);
        _uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task DbFailure_RollsBackKeycloakUser()
    {
        var newId = Guid.NewGuid();
        SetupNoPendingInvitation();
        SetupKeycloakCreate(newId);
        _uow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("simulated DB failure"));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewHandler().Handle(
                new RegisterUserCommand("fred@example.com", "Passw0rd!23", "Fred", IsOwner: false), default));

        _kc.Verify(k => k.DeleteUserAsync(newId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task WithInvitation_OrgAtCap_Throws402_AndDoesNotCreateKeycloakUser()
    {
        var orgId = Guid.NewGuid();
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(), OrganizationId = orgId, Email = "cap@example.com",
            Role = UserRole.Viewer, InvitedByUserId = Guid.NewGuid(),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(3), Token = "tok",
        };
        _invitations.Setup(r => r.FindPendingByEmailAsync("cap@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(invitation);
        _orgs.Setup(r => r.GetByIdAsync(orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = orgId, Plan = Plan.Free });
        _users.Setup(r => r.CountActiveMembersAsync(orgId, It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _invitations.Setup(r => r.CountPendingByOrgAsync(orgId, It.IsAny<CancellationToken>())).ReturnsAsync(1);

        await Assert.ThrowsAsync<PlanLimitExceededException>(() =>
            NewHandler().Handle(
                new RegisterUserCommand("cap@example.com", "Passw0rd!23", "Cap", IsOwner: false), default));

        _kc.Verify(k => k.CreateUserAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task WithoutInvitation_NoOrg_NoCapCheck()
    {
        var newId = Guid.NewGuid();
        SetupNoPendingInvitation();
        SetupKeycloakCreate(newId);

        var result = await NewHandler().Handle(
            new RegisterUserCommand("noorg@example.com", "Passw0rd!23", "NoOrg", IsOwner: false), default);

        result.OrganizationId.Should().BeNull();
        result.AttachedViaInvitation.Should().BeFalse();
        _orgs.Verify(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task InviteOnly_WithoutPendingInvitation_Throws_AndCreatesNoUser()
    {
        SetupNoPendingInvitation();

        await Assert.ThrowsAsync<RegistrationClosedException>(() =>
            NewHandler(inviteOnly: true).Handle(
                new RegisterUserCommand("stranger@example.com", "Passw0rd!23", "Stranger", IsOwner: false), default));

        _kc.Verify(k => k.CreateUserAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
        _uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task InviteOnly_WithPendingInvitation_StillRegisters()
    {
        var newId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(), OrganizationId = orgId, Email = "invited@example.com",
            Role = UserRole.Member, InvitedByUserId = Guid.NewGuid(),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(3), Token = "tok",
        };
        _invitations.Setup(r => r.FindPendingByEmailAsync("invited@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(invitation);
        SetupKeycloakCreate(newId);

        var result = await NewHandler(inviteOnly: true).Handle(
            new RegisterUserCommand("invited@example.com", "Passw0rd!23", "Invited", IsOwner: false), default);

        result.AttachedViaInvitation.Should().BeTrue();
        result.OrganizationId.Should().Be(orgId);
    }

    [Fact]
    public async Task EmailIsNormalized()
    {
        var newId = Guid.NewGuid();
        SetupNoPendingInvitation();
        SetupKeycloakCreate(newId);

        var result = await NewHandler().Handle(
            new RegisterUserCommand("  Alice@Example.COM  ", "Passw0rd!23", "Alice", IsOwner: false), default);

        result.Email.Should().Be("alice@example.com");
        _kc.Verify(k => k.CreateUserAsync(
            "alice@example.com", "Passw0rd!23", "Alice",
            "viewer", null, false, It.IsAny<CancellationToken>()), Times.Once);
        _invitations.Verify(r => r.FindPendingByEmailAsync(
            "alice@example.com", It.IsAny<CancellationToken>()), Times.Once);
    }
}
