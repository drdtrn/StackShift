using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackSift.Application.Commands.Auth;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Tests.Application.Commands.Auth;

public class AcceptInvitationCommandHandlerTests
{
    private readonly Mock<IKeycloakAdminClient> _kc = new();
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IInvitationRepository> _invitations = new();
    private readonly Mock<IOrganizationRepository> _orgs = new();

    private readonly Guid _orgId = Guid.NewGuid();

    public AcceptInvitationCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.Invitations).Returns(_invitations.Object);
        _uow.Setup(u => u.Organizations).Returns(_orgs.Object);
        _orgs.Setup(r => r.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Plan = Plan.Team });
    }

    private AcceptInvitationCommandHandler NewHandler() => new(
        _kc.Object, _uow.Object,
        NullLogger<AcceptInvitationCommandHandler>.Instance);

    private Invitation Pending(string token = "tok", DateTimeOffset? expiresAt = null, DateTimeOffset? acceptedAt = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            OrganizationId = _orgId,
            Email = "invitee@example.com",
            Role = UserRole.Admin,
            InvitedByUserId = Guid.NewGuid(),
            Token = token,
            ExpiresAt = expiresAt ?? DateTimeOffset.UtcNow.AddDays(3),
            AcceptedAt = acceptedAt,
        };

    [Fact]
    public async Task ValidToken_CreatesUser_AndMarksAccepted()
    {
        var invitation = Pending();
        var newId = Guid.NewGuid();
        _invitations.Setup(r => r.FindByTokenAsync("tok", It.IsAny<CancellationToken>())).ReturnsAsync(invitation);
        _kc.Setup(k => k.CreateUserAsync(
                invitation.Email, "Passw0rd!234", "Invitee", "admin", _orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(newId);

        var result = await NewHandler().Handle(
            new AcceptInvitationCommand("tok", "Passw0rd!234", "Invitee"), default);

        result.UserId.Should().Be(newId);
        result.OrganizationId.Should().Be(_orgId);
        result.Role.Should().Be(UserRole.Admin);
        invitation.AcceptedAt.Should().NotBeNull();

        _users.Verify(r => r.AddAsync(
            It.Is<User>(u =>
                u.Id == newId &&
                u.Email == invitation.Email &&
                u.Role == UserRole.Admin &&
                u.OrganizationId == _orgId &&
                u.InvitedByUserId == invitation.InvitedByUserId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UnknownToken_Returns409()
    {
        _invitations.Setup(r => r.FindByTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Invitation?)null);

        await Assert.ThrowsAsync<ConflictException>(() =>
            NewHandler().Handle(new AcceptInvitationCommand("missing", "Passw0rd!234", "X"), default));
    }

    [Fact]
    public async Task ExpiredToken_Returns409_AndDoesNotCallKeycloak()
    {
        var invitation = Pending(expiresAt: DateTimeOffset.UtcNow.AddMinutes(-1));
        _invitations.Setup(r => r.FindByTokenAsync("tok", It.IsAny<CancellationToken>())).ReturnsAsync(invitation);

        await Assert.ThrowsAsync<ConflictException>(() =>
            NewHandler().Handle(new AcceptInvitationCommand("tok", "Passw0rd!234", "X"), default));

        _kc.Verify(k => k.CreateUserAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task UsedToken_Returns409()
    {
        var invitation = Pending(acceptedAt: DateTimeOffset.UtcNow.AddMinutes(-5));
        _invitations.Setup(r => r.FindByTokenAsync("tok", It.IsAny<CancellationToken>())).ReturnsAsync(invitation);

        await Assert.ThrowsAsync<ConflictException>(() =>
            NewHandler().Handle(new AcceptInvitationCommand("tok", "Passw0rd!234", "X"), default));
    }

    [Fact]
    public async Task DbFailure_RollsBackKeycloakUser()
    {
        var invitation = Pending();
        var newId = Guid.NewGuid();
        _invitations.Setup(r => r.FindByTokenAsync("tok", It.IsAny<CancellationToken>())).ReturnsAsync(invitation);
        _kc.Setup(k => k.CreateUserAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(newId);
        _uow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("simulated db"));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewHandler().Handle(new AcceptInvitationCommand("tok", "Passw0rd!234", "X"), default));

        _kc.Verify(k => k.DeleteUserAsync(newId, It.IsAny<CancellationToken>()), Times.Once);
    }
}
