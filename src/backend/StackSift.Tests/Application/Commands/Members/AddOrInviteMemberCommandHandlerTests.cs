using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackSift.Application.Commands.Members;
using StackSift.Application.Interfaces;
using StackSift.Domain;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Domain.ValueObjects;

namespace StackSift.Tests.Application.Commands.Members;

public class AddOrInviteMemberCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IInvitationRepository> _invitations = new();
    private readonly Mock<IOrganizationRepository> _orgs = new();
    private readonly Mock<IKeycloakAdminClient> _kc = new();
    private readonly Mock<IEmailService> _email = new();
    private readonly Mock<IMemberEmailComposer> _composer = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();

    private readonly Guid _orgId = Guid.NewGuid();
    private readonly Guid _inviterId = Guid.NewGuid();

    public AddOrInviteMemberCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.Invitations).Returns(_invitations.Object);
        _uow.Setup(u => u.Organizations).Returns(_orgs.Object);

        _currentUser.Setup(u => u.OrganizationId).Returns(_orgId);
        _currentUser.Setup(u => u.UserId).Returns(_inviterId);

        _orgs.Setup(o => o.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Name = "Acme", Slug = "acme" });
        _users.Setup(r => r.GetByIdAsync(_inviterId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new User { Id = _inviterId, Email = "owner@acme.com", DisplayName = "Owen", Role = UserRole.Owner, OrganizationId = _orgId });

        _composer.Setup(c => c.BuildMemberAdded(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<UserRole>()))
            .Returns(new EmailMessage("x", "s", "<p/>", null, null));
        _composer.Setup(c => c.BuildInvitation(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<UserRole>(), It.IsAny<string>(), It.IsAny<DateTimeOffset>()))
            .Returns(new EmailMessage("x", "s", "<p/>", null, null));
    }

    private AddOrInviteMemberCommandHandler NewHandler() => new(
        _uow.Object, _kc.Object, _email.Object, _composer.Object,
        _currentUser.Object, NullLogger<AddOrInviteMemberCommandHandler>.Instance);

    [Fact]
    public async Task RegisteredEmail_NoOrg_Attaches_AndSendsNotification()
    {
        var existing = new User
        {
            Id = Guid.NewGuid(),
            Email = "viewer@example.com",
            DisplayName = "V",
            Role = UserRole.Viewer,
            OrganizationId = null,
        };
        _users.Setup(r => r.FindByEmailAsync("viewer@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        var result = await NewHandler().Handle(
            new AddOrInviteMemberCommand(_orgId, "viewer@example.com", UserRole.Member), default);

        result.Member.Should().NotBeNull();
        result.Invitation.Should().BeNull();
        result.Member!.Role.Should().Be(UserRole.Member);
        existing.OrganizationId.Should().Be(_orgId);
        existing.Role.Should().Be(UserRole.Member);
        existing.InvitedByUserId.Should().Be(_inviterId);

        _kc.Verify(k => k.SetUserAttributesAsync(existing.Id, "member", _orgId, It.IsAny<CancellationToken>()), Times.Once);
        _email.Verify(e => e.SendAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RegisteredEmail_AlreadyInThisOrg_Returns409()
    {
        _users.Setup(r => r.FindByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new User { Id = Guid.NewGuid(), Email = "x", OrganizationId = _orgId, Role = UserRole.Member });

        await Assert.ThrowsAsync<ConflictException>(() =>
            NewHandler().Handle(new AddOrInviteMemberCommand(_orgId, "x", UserRole.Member), default));
    }

    [Fact]
    public async Task RegisteredEmail_InAnotherOrg_Returns409()
    {
        _users.Setup(r => r.FindByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new User { Id = Guid.NewGuid(), Email = "x", OrganizationId = Guid.NewGuid(), Role = UserRole.Member });

        await Assert.ThrowsAsync<ConflictException>(() =>
            NewHandler().Handle(new AddOrInviteMemberCommand(_orgId, "x", UserRole.Member), default));
    }

    [Fact]
    public async Task UnregisteredEmail_CreatesInvitation_AndSendsInviteEmail()
    {
        _users.Setup(r => r.FindByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);
        _invitations.Setup(r => r.FindPendingByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Invitation?)null);

        var result = await NewHandler().Handle(
            new AddOrInviteMemberCommand(_orgId, "new@example.com", UserRole.Admin), default);

        result.Invitation.Should().NotBeNull();
        result.Member.Should().BeNull();
        result.Invitation!.Role.Should().Be(UserRole.Admin);
        result.Invitation.Email.Should().Be("new@example.com");

        _invitations.Verify(r => r.AddAsync(
            It.Is<Invitation>(i =>
                i.Email == "new@example.com" &&
                i.Role == UserRole.Admin &&
                i.OrganizationId == _orgId &&
                i.InvitedByUserId == _inviterId &&
                !string.IsNullOrEmpty(i.Token) &&
                i.ExpiresAt > DateTimeOffset.UtcNow),
            It.IsAny<CancellationToken>()), Times.Once);
        _email.Verify(e => e.SendAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UnregisteredEmail_WithPendingInvitation_RefreshesExistingRow()
    {
        var existingInvitation = new Invitation
        {
            Id = Guid.NewGuid(),
            OrganizationId = _orgId,
            Email = "pending@example.com",
            Role = UserRole.Viewer,
            InvitedByUserId = _inviterId,
            Token = "old-token",
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(1),
        };
        _users.Setup(r => r.FindByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);
        _invitations.Setup(r => r.FindPendingByEmailAsync("pending@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingInvitation);

        var result = await NewHandler().Handle(
            new AddOrInviteMemberCommand(_orgId, "pending@example.com", UserRole.Admin), default);

        result.Invitation.Should().NotBeNull();
        existingInvitation.Role.Should().Be(UserRole.Admin);
        existingInvitation.Token.Should().NotBe("old-token");

        _invitations.Verify(r => r.AddAsync(It.IsAny<Invitation>(), It.IsAny<CancellationToken>()), Times.Never);
        _invitations.Verify(r => r.UpdateAsync(existingInvitation, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task KeycloakFailureOnAttach_RollsBackDbRow()
    {
        var existing = new User
        {
            Id = Guid.NewGuid(), Email = "v", DisplayName = "V",
            Role = UserRole.Viewer, OrganizationId = null,
        };
        _users.Setup(r => r.FindByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);
        _kc.Setup(k => k.SetUserAttributesAsync(
                existing.Id, It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("simulated"));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewHandler().Handle(new AddOrInviteMemberCommand(_orgId, "v", UserRole.Member), default));

        existing.OrganizationId.Should().BeNull();
        existing.Role.Should().Be(UserRole.Viewer);
        existing.InvitedByUserId.Should().BeNull();
        _uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.AtLeast(2));
    }

    [Fact]
    public async Task OwnerRoleAllowed_OnAttach()
    {
        var existing = new User
        {
            Id = Guid.NewGuid(), Email = "v", DisplayName = "V",
            Role = UserRole.Viewer, OrganizationId = null,
        };
        _users.Setup(r => r.FindByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        var result = await NewHandler().Handle(
            new AddOrInviteMemberCommand(_orgId, "v", UserRole.Owner), default);

        result.Member!.Role.Should().Be(UserRole.Owner);
        _kc.Verify(k => k.SetUserAttributesAsync(existing.Id, "owner", _orgId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CrossTenant_OrgIdMismatch_Returns404()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            NewHandler().Handle(
                new AddOrInviteMemberCommand(Guid.NewGuid(), "x@example.com", UserRole.Member), default));
    }

    [Fact]
    public async Task FreeOrgAtCap_AttachingExistingUser_Throws402()
    {
        _orgs.Setup(o => o.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Name = "Acme", Slug = "acme", Plan = Plan.Free });
        _users.Setup(r => r.CountActiveMembersAsync(_orgId, It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _invitations.Setup(r => r.CountPendingByOrgAsync(_orgId, It.IsAny<CancellationToken>())).ReturnsAsync(0);

        var existing = new User { Id = Guid.NewGuid(), Email = "v@x.com", DisplayName = "V", Role = UserRole.Viewer, OrganizationId = null };
        _users.Setup(r => r.FindByEmailAsync("v@x.com", It.IsAny<CancellationToken>())).ReturnsAsync(existing);

        await Assert.ThrowsAsync<PlanLimitExceededException>(() =>
            NewHandler().Handle(new AddOrInviteMemberCommand(_orgId, "v@x.com", UserRole.Viewer), default));

        _kc.Verify(k => k.SetUserAttributesAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task FreeOrgAtCap_CreatingNewInvitation_Throws402()
    {
        _orgs.Setup(o => o.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Name = "Acme", Slug = "acme", Plan = Plan.Free });
        _users.Setup(r => r.CountActiveMembersAsync(_orgId, It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _invitations.Setup(r => r.CountPendingByOrgAsync(_orgId, It.IsAny<CancellationToken>())).ReturnsAsync(0);
        _users.Setup(r => r.FindByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync((User?)null);
        _invitations.Setup(r => r.FindPendingByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync((Invitation?)null);

        await Assert.ThrowsAsync<PlanLimitExceededException>(() =>
            NewHandler().Handle(new AddOrInviteMemberCommand(_orgId, "new@x.com", UserRole.Viewer), default));

        _invitations.Verify(r => r.AddAsync(It.IsAny<Invitation>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task FreeOrgAtCap_RefreshingExistingPendingInvitation_Succeeds()
    {
        _orgs.Setup(o => o.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Name = "Acme", Slug = "acme", Plan = Plan.Free });
        _users.Setup(r => r.CountActiveMembersAsync(_orgId, It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _invitations.Setup(r => r.CountPendingByOrgAsync(_orgId, It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var existingPending = new Invitation
        {
            Id = Guid.NewGuid(), OrganizationId = _orgId, Email = "pending@x.com",
            Role = UserRole.Viewer, InvitedByUserId = _inviterId,
            Token = "old-token", ExpiresAt = DateTimeOffset.UtcNow.AddDays(1),
        };
        _users.Setup(r => r.FindByEmailAsync("pending@x.com", It.IsAny<CancellationToken>())).ReturnsAsync((User?)null);
        _invitations.Setup(r => r.FindPendingByEmailAsync("pending@x.com", It.IsAny<CancellationToken>())).ReturnsAsync(existingPending);

        var result = await NewHandler().Handle(new AddOrInviteMemberCommand(_orgId, "pending@x.com", UserRole.Admin), default);

        result.Invitation.Should().NotBeNull();
        existingPending.Role.Should().Be(UserRole.Admin);
        existingPending.Token.Should().NotBe("old-token");
        _invitations.Verify(r => r.AddAsync(It.IsAny<Invitation>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task TeamOrg_AtFiveMembers_StillAllowsAttach()
    {
        _orgs.Setup(o => o.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Name = "Acme", Slug = "acme", Plan = Plan.Team });
        _users.Setup(r => r.CountActiveMembersAsync(_orgId, It.IsAny<CancellationToken>())).ReturnsAsync(5);
        _invitations.Setup(r => r.CountPendingByOrgAsync(_orgId, It.IsAny<CancellationToken>())).ReturnsAsync(0);

        var existing = new User { Id = Guid.NewGuid(), Email = "v@x.com", DisplayName = "V", Role = UserRole.Viewer, OrganizationId = null };
        _users.Setup(r => r.FindByEmailAsync("v@x.com", It.IsAny<CancellationToken>())).ReturnsAsync(existing);

        var result = await NewHandler().Handle(new AddOrInviteMemberCommand(_orgId, "v@x.com", UserRole.Member), default);

        result.Member.Should().NotBeNull();
    }
}
