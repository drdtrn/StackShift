using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackSift.Application.Commands.Members;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Tests.Application.Commands.Members;

public class RemoveMemberCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IKeycloakAdminClient> _kc = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Guid _orgId = Guid.NewGuid();

    public RemoveMemberCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _currentUser.Setup(u => u.OrganizationId).Returns(_orgId);
    }

    private RemoveMemberCommandHandler NewHandler() => new(
        _uow.Object, _kc.Object, _currentUser.Object,
        NullLogger<RemoveMemberCommandHandler>.Instance);

    [Fact]
    public async Task RemoveLastOwner_Returns409()
    {
        var target = new User { Id = Guid.NewGuid(), OrganizationId = _orgId, Role = UserRole.Owner };
        _users.Setup(r => r.GetByIdAsync(target.Id, It.IsAny<CancellationToken>())).ReturnsAsync(target);
        _users.Setup(r => r.CountOwnersAsync(_orgId, It.IsAny<CancellationToken>())).ReturnsAsync(1);

        await Assert.ThrowsAsync<ConflictException>(() =>
            NewHandler().Handle(new RemoveMemberCommand(_orgId, target.Id), default));

        target.OrganizationId.Should().Be(_orgId);
        target.Role.Should().Be(UserRole.Owner);
    }

    [Fact]
    public async Task RemoveMember_ClearsOrgAndRole_OnDbAndKeycloak()
    {
        var target = new User
        {
            Id = Guid.NewGuid(),
            OrganizationId = _orgId,
            Role = UserRole.Member,
            InvitedByUserId = Guid.NewGuid(),
        };
        _users.Setup(r => r.GetByIdAsync(target.Id, It.IsAny<CancellationToken>())).ReturnsAsync(target);

        await NewHandler().Handle(new RemoveMemberCommand(_orgId, target.Id), default);

        target.OrganizationId.Should().BeNull();
        target.Role.Should().Be(UserRole.Viewer);
        target.InvitedByUserId.Should().BeNull();

        _kc.Verify(k => k.SetUserAttributesAsync(target.Id, "viewer", null, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RemoveOwner_WhenMultipleOwners_Succeeds()
    {
        var target = new User { Id = Guid.NewGuid(), OrganizationId = _orgId, Role = UserRole.Owner };
        _users.Setup(r => r.GetByIdAsync(target.Id, It.IsAny<CancellationToken>())).ReturnsAsync(target);
        _users.Setup(r => r.CountOwnersAsync(_orgId, It.IsAny<CancellationToken>())).ReturnsAsync(2);

        await NewHandler().Handle(new RemoveMemberCommand(_orgId, target.Id), default);

        target.OrganizationId.Should().BeNull();
        target.Role.Should().Be(UserRole.Viewer);
    }

    [Fact]
    public async Task KeycloakFailure_RollsBackFields()
    {
        var target = new User
        {
            Id = Guid.NewGuid(),
            OrganizationId = _orgId,
            Role = UserRole.Member,
            InvitedByUserId = Guid.NewGuid(),
        };
        var inviter = target.InvitedByUserId;
        _users.Setup(r => r.GetByIdAsync(target.Id, It.IsAny<CancellationToken>())).ReturnsAsync(target);
        _kc.Setup(k => k.SetUserAttributesAsync(
                target.Id, It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("simulated"));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewHandler().Handle(new RemoveMemberCommand(_orgId, target.Id), default));

        target.OrganizationId.Should().Be(_orgId);
        target.Role.Should().Be(UserRole.Member);
        target.InvitedByUserId.Should().Be(inviter);
    }
}
