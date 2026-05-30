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

public class UpdateMemberRoleCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IKeycloakAdminClient> _kc = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Mock<IAuditLog> _audit = new();

    private readonly Guid _orgId = Guid.NewGuid();

    public UpdateMemberRoleCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _currentUser.Setup(u => u.OrganizationId).Returns(_orgId);
    }

    private UpdateMemberRoleCommandHandler NewHandler() => new(
        _uow.Object, _kc.Object, _currentUser.Object, _audit.Object,
        NullLogger<UpdateMemberRoleCommandHandler>.Instance);

    private User MakeUser(UserRole role)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "u",
            DisplayName = "U",
            Role = role,
            OrganizationId = _orgId,
        };
        _users.Setup(r => r.GetByIdAsync(user.Id, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        return user;
    }

    [Fact]
    public async Task PromoteMemberToOwner_Succeeds()
    {
        var target = MakeUser(UserRole.Member);

        var result = await NewHandler().Handle(
            new UpdateMemberRoleCommand(_orgId, target.Id, UserRole.Owner), default);

        result.Role.Should().Be(UserRole.Owner);
        target.Role.Should().Be(UserRole.Owner);
        _kc.Verify(k => k.SetUserAttributesAsync(target.Id, "owner", _orgId, It.IsAny<CancellationToken>()), Times.Once);
        _audit.Verify(a => a.WriteAsync(
            AuditEvent.MemberRoleChanged, _orgId, null, null, target.Id, "User",
            It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DemoteLastOwner_Returns409()
    {
        var target = MakeUser(UserRole.Owner);
        _users.Setup(r => r.CountOwnersAsync(_orgId, It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            NewHandler().Handle(new UpdateMemberRoleCommand(_orgId, target.Id, UserRole.Admin), default));
        ex.Message.Should().Contain("last owner");
        target.Role.Should().Be(UserRole.Owner);
    }

    [Fact]
    public async Task DemoteOwner_WhenMultipleOwners_Succeeds()
    {
        var target = MakeUser(UserRole.Owner);
        _users.Setup(r => r.CountOwnersAsync(_orgId, It.IsAny<CancellationToken>())).ReturnsAsync(2);

        var result = await NewHandler().Handle(
            new UpdateMemberRoleCommand(_orgId, target.Id, UserRole.Admin), default);

        result.Role.Should().Be(UserRole.Admin);
        target.Role.Should().Be(UserRole.Admin);
    }

    [Fact]
    public async Task CrossTenant_Returns404()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            NewHandler().Handle(new UpdateMemberRoleCommand(Guid.NewGuid(), Guid.NewGuid(), UserRole.Member), default));
    }

    [Fact]
    public async Task TargetInDifferentOrg_Returns404()
    {
        var target = new User { Id = Guid.NewGuid(), OrganizationId = Guid.NewGuid(), Role = UserRole.Member };
        _users.Setup(r => r.GetByIdAsync(target.Id, It.IsAny<CancellationToken>())).ReturnsAsync(target);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            NewHandler().Handle(new UpdateMemberRoleCommand(_orgId, target.Id, UserRole.Admin), default));
    }

    [Fact]
    public async Task KeycloakFailure_RollsBackRole()
    {
        var target = MakeUser(UserRole.Member);
        _kc.Setup(k => k.SetUserAttributesAsync(
                target.Id, It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("kc down"));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewHandler().Handle(new UpdateMemberRoleCommand(_orgId, target.Id, UserRole.Admin), default));

        target.Role.Should().Be(UserRole.Member);
    }
}
